<?php

namespace Lightenna\StructuredBundle\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;

/** These constants are only defined here, though referenced elsewhere **/
define('DEBUG', true);
define('DIR_SEPARATOR', '/');
define('FOLDER_NAME', 'structured');
define('ZIP_EXTMATCH', 'zip');
define('ZIP_SEPARATOR', '/');
define('ARG_SEPARATOR', '~args&');
define('SUB_REGEX', '/\[([0-9i]*)\]/');

class ViewController extends Controller {

  protected $settings;
  // @param object URL arguments
  protected $args;
  // @param FileReader object
  protected $mfr;

  public function __construct() {
    $settings_file = $this->convertRawToInternalFilename('conf/structured.ini');
    $this->settings = parse_ini_file($settings_file, true);
    // pull in conf.d settings
    if (isset($this->settings['general'])) {
      if (isset($this->settings['general']['confd'])) {
        // read all directory entries
        $confdirname = $this->convertRawToInternalFilename($this->settings['general']['confd']);
        // check the directory exists
        if (is_dir($confdirname)) {
          // process settings if found
          $localmfr = new MetadataFileReader($confdirname, $this);
          $listing = $localmfr->getListing();
          // parse each .ini file
          foreach ($listing as $entry) {
            if (strtolower($entry->ext) == 'ini') {
              // add to settings
              $subsets = parse_ini_file($confdirname . DIR_SEPARATOR . $entry->name, true);
              $this->settings = array_merge_recursive($this->settings, $subsets);
            }
          }
        }
      }
    }
    // process settings
    $this->processSettings();
  }

  /**
   * overwrite the arguments (used for testing)
   * @param object $a new arguments
   */

  public function setArgs($a) {
    $this->args = $a;
  }

  /**
   * overwrite the arguments (used for testing)
   * @param array $a new arguments
   */

  public function setArgsByArray($a) {
    $this->args = (object)$a;
  }

  /**
   * @return object arguments array
   */

  public function getArgs() {
    return $this->args;
  }

  /**
   * Process settings array for actions
   */
  private function processSettings() {
    // if memory limit set, apply
    if (isset($this->settings['general']['memory_limit'])) {
      if (!ini_set('memory_limit', $this->settings['general']['memory_limit'])) {
        throw new \Exception('Your system does not have enough free RAM to allocate the amount of memory specified in your settings file.');
      }
    }
    // identify and attach shares
    $this->settings['shares'] = $this->findShares($this->settings);
    $attach = array();
    if (is_array($this->settings['shares'])) {
      // build array of attach points
      foreach ($this->settings['shares'] as $k => &$sh) {
        // trim first slash from attach point
        $sh['attach'] = ltrim($sh['attach'], DIR_SEPARATOR);
        // combine attach and name for matching later
        $sh['attachname'] = ltrim($sh['attach'] . DIR_SEPARATOR . $sh['name'], DIR_SEPARATOR);
        // define each unique attach point as an array
        if (!isset($attach[$sh['attach']])) {
          $attach[$sh['attach']] = array();
        }
        // add this shares to that attach point
        $attach[$sh['attach']][] = &$sh;
      }
    }
    $this->settings['attach'] = $attach;
    // fill in missing paths
    if (!isset($this->settings['general']['path_ffmpeg'])) {
      $this->settings['general']['path_ffmpeg'] = self::convertRawToInternalFilename('vendor/ffmpeg/bin') . '/';
    }
  }

  /**
   * @return array Settings
   */

  public function getSettings() {
    return $this->settings;
  }

  /**
   * parse settings array, look for and return shares
   * @param  Array $arr to search
   * @todo could insert validation here to check values
   * @return Array shares
   */

  private function findShares($arr) {
    $shares = array();
    foreach ($arr as &$entry) {
      if (isset($entry['type']) && ($entry['type'] == 'share')) {
        if (isset($entry['enabled']) && ($entry['enabled'] == false)) {
          // ignore disabled shares
          continue;
        }
        // test existance of each folder
        if (!file_exists($entry['path'])) {
          // try as relative path
          $newpath = $this->convertRawToFilename($entry['path']);
          if (file_exists($newpath)) {
            $entry['path'] = $newpath;
          }
        }
        // add to shares array
        $shares[] = &$entry;
      }
    }
    return $shares;
  }

  /**
   * substitute references out of filename
   * @param  string $filename filename (not raw) containing references
   * @return string filename with substitutions
   */

  private function performFilenameSubstitution($name, $filename) {
    // substitute 'share' name for share path
    if (isset($this->settings['shares'])) {
      // try and match name against an attached share
      foreach ($this->settings['shares'] as $k => $share) {
        if ($share['attachname'] == substr($name, 0, strlen($share['attachname']))) {
          // rewrite filename to use share path instead
          $filename = rtrim($share['path'], DIR_SEPARATOR) . DIR_SEPARATOR . ltrim(substr($name, strlen($share['attachname'])), DIR_SEPARATOR);
        }
      }
    }
    // search string for nth references [1]
    $matches = array();
    // if there are no matches, substitution is same as input
    $subname = $filename;
    if (preg_match_all(SUB_REGEX, $filename, $matches, PREG_OFFSET_CAPTURE)) {
      // record substitutions in new string called subname
      // this is the full path up to this match
      $subname = '';
      if (false) {
        print('<pre>' . print_r($matches, true) . '</pre>');
      }
      // mark position of last ] (i.e. last character in [2])
      $lastpos = 0;
      // loop through () part of regex matches
      foreach ($matches[1] as $match) {
        // get bit of path from last match (or start) to here
        if ($lastpos == 0) {
          // use $match[1]-1 because match is preceded by opening []
          $addition = substr($filename, 0, $match[1] - 1);
        }
        else {
          $addition = substr($filename, $lastpos, $match[1] - 1 - $lastpos);
        }
        // subname gets real bit of path (from start, or last match)
        $subname .= $addition;
        // find file using that path
        // strip trailing slash because findFind works off either a directory/zip
        $matched_leaf = $this->findFile(rtrim($subname, DIR_SEPARATOR), $match[0]);
        // add found file to path
        if ($matched_leaf === false) {
          // fail, unable to find that file
          throw $this->createNotFoundException('Unable to find a file matching those parameters');
        }
        else {
          $subname .= $matched_leaf;
        }
        $lastpos = $match[1] + 1 + strlen($match[0]);
      }
      // attach remainder (unprocessed part) of filename after last match
      $addition = substr($filename, $lastpos, strlen($filename) - $lastpos);
      ;
      // but remainder may include a trailing slash
      $subname .= rtrim($addition, DIR_SEPARATOR);
    }
    return $subname;
  }

  /**
   * find a file by reference within a folder/zip
   * @todo  this assumes (for zips) that the match is being done immediately after a zip, but it could be a subfolder of a zip
   * @param  string $filepath path to the folder to search
   * @param  string $match reference of file to find
   * @return string file leaf name, or false if failed
   */

  public function findFile($filepath, $match) {
    $this->mfr = new CachedMetadataFileReader($filepath, $this);
    $listing = $this->mfr->getListing();
    // parse match to work out type
    switch ($match[0]) {
      case 'i':
        $match_type = 'image';
        $match = intval(substr($match, 1));
        break;
      case 'n':
        $match_type = 'counter';
        $match = intval(substr($match, 1));
        break;
      default:
        $match_type = 'counter';
        $match = intval($match);
        break;
    }
    // parse listing to match $match
    $entry_counter = 0;
    $type_counter = array();
    foreach ($listing as $entry) {
      $enttype = $entry->type;
      // videos are shown as image thumbnails
      if ($enttype == 'video') $enttype = 'image';
      // update counters (making first entry = 1)
      $entry_counter++;
      if (!isset($type_counter[$enttype])) {
        $type_counter[$enttype] = 0;
      }
      $type_counter[$enttype]++;
      // look for match
      if ($match_type == 'counter') {
        // by default, match against counter
        if ($match == $entry_counter) {
          return $entry->name;
        }
      } else if ($match_type == $enttype) {
        if ($match == $type_counter[$enttype]) {
          return $entry->name;
        }
      }
    }
    return false;
  }

  /**
   * Note: all URLs go through this function (or internal version below) to become filenames
   * @return Filename without trailing slash
   */

  public function convertRawToFilename($name) {
    $name = rtrim($name, DIR_SEPARATOR);
    // return composite path to real root (back up out of symfony)
    $filename = rtrim($_SERVER['DOCUMENT_ROOT'], DIR_SEPARATOR) . str_repeat(DIR_SEPARATOR . '..', 3);
    // catch case where command line execution means DOCUMENT_ROOT is empty
    if ($_SERVER['DOCUMENT_ROOT'] == '') {
      if (isset($_SERVER['PHPRC'])) {
        // use php conf directory, which should be consistent across both
        $filename = rtrim($_SERVER['PHPRC'], DIR_SEPARATOR) . str_repeat(DIR_SEPARATOR . '..', 2);
      }
      else {
        if (isset($_SERVER['PWD'])) {
          // use php pwd
          $filename = rtrim($_SERVER['PWD'], DIR_SEPARATOR) . str_repeat(DIR_SEPARATOR . '..', 2);
        }
      }
    }
    $filename .= DIR_SEPARATOR . ltrim($name, DIR_SEPARATOR);
    $sub = $this->performFilenameSubstitution($name, $filename);
    return rtrim($sub, DIR_SEPARATOR);
  }

  /**
   * @return Filename within structured folder without trailing slash
   */

  public function convertRawToInternalFilename($name) {
    return $this->convertRawToFilename(FOLDER_NAME . DIR_SEPARATOR . $name);
  }

  /**
   * @return URL name without trailing slash
   */

  static function convertRawToUrl($name) {
    return DIR_SEPARATOR . trim($name, DIR_SEPARATOR);
  }

  /**
   * get any arguments that feature on the filename
   * @param $name full path
   * @return object
   */

  static function getArgsFromPath($name) {
    $args = new \stdClass();
    // strip args if present
    $arg_pos = strpos($name, ARG_SEPARATOR);
    if ($arg_pos === false) {
      // no arguments found
    }
    else {
      $char_split = explode('&', substr($name, $arg_pos + strlen(ARG_SEPARATOR)));
      foreach ($char_split as $char_var) {
        if ($char_var == '') {
          continue;
        }
        if (strpos($char_var, '=') === false) {
          $args->{$char_var} = null;
          continue;
        }
        list($k, $v) = explode('=', $char_var);
        $args->{$k} = $v;
      }
    }
    return $args;
  }

}
