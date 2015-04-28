<?php

namespace Lightenna\StructuredBundle\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

define('SUB_REGEX', '/\[([0-9i]*)\]/');

class ViewController extends Controller {

  protected $settings;
  // @param object URL arguments
  protected $args;
  // @param FileReader object
  protected $mfr;
  // @param string URL requested
  protected $rawname = null;

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
          foreach ($listing as $obj) {
            if (strtolower($obj->getExt()) == 'ini') {
              // add to settings
              $subsets = parse_ini_file($confdirname . Constantly::DIR_SEPARATOR_URL . $obj->getName(), true);
              $this->settings = array_merge_recursive($this->settings, $subsets);
            }
          }
        }
      }
    }
    // add in server-generated client settings
    if (!isset($this->settings['client']) || !is_array($this->settings['client'])) {
      $this->settings['client'] = array();
    }
    $this->settings['client']['sfun_version'] = Constantly::SFUN_VERSION;
    // process settings
    $this->processSettings();
    // get database connection
    if (false) {
      // create database from scratch
      $schemaTool = new \Doctrine\ORM\Tools\SchemaTool($entityManager);
      $classes = $entityManager->getMetadataFactory()->getAllMetadata();
      $schemaTool->createSchema($classes);
    }
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

  public function getRawname() {
    return rtrim($this->rawname, Constantly::DIR_SEPARATOR_URL);
  }

  /**
   * @return array Settings
   */

  public function getSettings() {
    return $this->settings;
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
        $sh['attach'] = ltrim($sh['attach'], Constantly::DIR_SEPARATOR_URL);
        // combine attach and name for matching later
        $sh['attachname'] = ltrim($sh['attach'] . Constantly::DIR_SEPARATOR_URL . $sh['name'], Constantly::DIR_SEPARATOR_URL);
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
          $filename = rtrim($share['path'], Constantly::DIR_SEPARATOR_URL) . Constantly::DIR_SEPARATOR_URL . ltrim(substr($name, strlen($share['attachname'])), Constantly::DIR_SEPARATOR_URL);
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
        $matched_leaf = $this->findFile(rtrim($subname, Constantly::DIR_SEPARATOR_URL), $match[0]);
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
      $subname .= rtrim($addition, Constantly::DIR_SEPARATOR_URL);
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
    foreach ($listing as $obj) {
      $enttype = $obj->getType();
      // videos are shown as image thumbnails
      if ($enttype == 'video') $enttype = 'image';
      // update counters (making first obj = 1)
      $entry_counter++;
      if (!isset($type_counter[$enttype])) {
        $type_counter[$enttype] = 0;
      }
      $type_counter[$enttype]++;
      // look for match
      if ($match_type == 'counter') {
        // by default, match against counter
        if ($match == $entry_counter) {
          return $obj->getName();
        }
      } else if ($match_type == $enttype) {
        if ($match == $type_counter[$enttype]) {
          return $obj->getName();
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
    // convert utf8 to iso-8859-1
    $name = iconv( "utf-8", "iso-8859-1//ignore", $name );
    // swap out slash alias notation
    $name = CachedMetadataFileReader::reverse_hash($name);
    // strip trailing slash
    $name = rtrim($name, Constantly::DIR_SEPARATOR_URL);
    // return composite path to real root (back up out of symfony)
    $filename = rtrim($_SERVER['DOCUMENT_ROOT'], Constantly::DIR_SEPARATOR_URL) . str_repeat(Constantly::DIR_SEPARATOR_URL . '..', 3);
    // catch case where command line execution means DOCUMENT_ROOT is empty
    if ($_SERVER['DOCUMENT_ROOT'] == '') {
      if (isset($_SERVER['PHPRC'])) {
        // use php conf directory, which should be consistent across both
        $filename = rtrim($_SERVER['PHPRC'], Constantly::DIR_SEPARATOR_URL) . str_repeat(Constantly::DIR_SEPARATOR_URL . '..', 2);
      }
      else {
        if (isset($_SERVER['PWD'])) {
          // use php pwd
          $filename = rtrim($_SERVER['PWD'], Constantly::DIR_SEPARATOR_URL) . str_repeat(Constantly::DIR_SEPARATOR_URL . '..', 2);
        }
      }
    }
    $filename .= Constantly::DIR_SEPARATOR_URL . ltrim($name, Constantly::DIR_SEPARATOR_URL);
    $sub = $this->performFilenameSubstitution($name, $filename);
    return rtrim($sub, Constantly::DIR_SEPARATOR_URL);
  }

  /**
   * @return Filename within structured folder without trailing slash
   */

  public function convertRawToInternalFilename($name) {
    return $this->convertRawToFilename(Constantly::FOLDER_NAME . Constantly::DIR_SEPARATOR_URL . $name);
  }

  /**
   * Output an image with correct headers
   * @param string $imgdata Raw image data as a string
   */
  protected function returnImage($imgdata) {
    $ext = 'jpeg';
    if (isset($this->{'stats'})) {
      $ext = $this->stats->getExt();
    }
    if (!headers_sent()) {
      header("Content-Type: image/" . $ext);
      header("Content-Length: " . strlen($imgdata));
    }
    echo $imgdata;
    exit;
  }

  protected function getParameterOrDefault($name, $default) {
    $request = $this->getRequest();
    $param_value = $request->get($name);
    if ($param_value === null) {
      $param_value = $default;
    }
    return $param_value;
  }

  /**
   * @return URL name without trailing slash
   */

  static function convertRawToUrl($name) {
    return Constantly::DIR_SEPARATOR_URL . trim($name, Constantly::DIR_SEPARATOR_URL);
  }

  /**
   * get any arguments that feature on the filename
   * @param $name full path
   * @return object
   */

  static function getArgsFromPath($name) {
    $args = new \stdClass();
    // strip args if present
    $arg_pos = strpos($name, Constantly::ARG_SEPARATOR);
    if ($arg_pos === false) {
      // no arguments found
    }
    else {
      $char_split = explode('&', substr($name, $arg_pos + strlen(Constantly::ARG_SEPARATOR)));
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
