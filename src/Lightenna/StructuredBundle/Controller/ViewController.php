<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\Encoder\XmlEncoder;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Response;
use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\Entity\EntryLayout;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\DatabaseLocalManager;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;
use Lightenna\StructuredBundle\DependencyInjection\Timer;

define('SUB_REGEX', '/\[([0-9i]*)\]/');

class ViewController extends Controller
{

    protected $settings = null;
    // @param Arguments URL arguments
    protected $args;
    // @param FileReader object
    protected $mfr;
    // @param string URL requested
    protected $rawname = null;
    // @param string[] error buffer
    protected $errbuf = null;
    // @param Request Symfony request object
    protected $request = null;
    // @param Timer
    protected $timer = null;
    // @param DB
    protected $db = null;

    public function __construct()
    {
        // capture start time for internal timing functions
        $this->timer = new Timer();
        // initialise, read then process settings
        $this->getSettings();
        MetadataFileReader::readSettingsFile($this->settings, $this->convertRawToInternalFilename('conf/structured.ini'));
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
                        if (strtolower($entry->getExt()) == 'ini') {
                            // add to settings
                            $subsets = parse_ini_file($confdirname . Constantly::DIR_SEPARATOR_URL . $entry->getName(), true);
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
        // create database manager object for later
        $this->db = new DatabaseLocalManager($this);
    }

    /**
     * overwrite the arguments (used for testing)
     * @param object $a new arguments
     */

    public function setArgs($a)
    {
        $this->args = $a;
    }

    /**
     * overwrite the arguments (used for testing)
     * @param array $a new arguments
     */

    public function setArgsByArray($a)
    {
        $this->args = (object)$a;
    }

    /**
     * @return object arguments array
     */

    public function getArgs()
    {
        return $this->args;
    }

    /**
     * @return object DB manager
     */
    public function getDB()
    {
        return $this->db();
    }

    public function getDoctrine()
    {
        return $this->getDoctrine();
    }

    public function getRawname()
    {
        return rtrim($this->rawname, Constantly::DIR_SEPARATOR_URL);
    }

    /**
     * @return array Settings
     */

    public function getSettings()
    {
        if ($this->settings === null) {
            $this->settings = array();
        }
        return $this->settings;
    }

    /**
     * @return string server name and port
     */
    public function getServerCompound()
    {
        return $_SERVER['SERVER_NAME'] . ':' . $_SERVER['SERVER_PORT'];
    }

    /**
     * Process settings array for actions
     */
    private function processSettings()
    {
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

    private function findShares($arr)
    {
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

    private function performFilenameSubstitution($name, $filename)
    {
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
        // search string for nth references e.g. [1]
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
                } else {
                    $addition = substr($filename, $lastpos, $match[1] - 1 - $lastpos);
                }
                // subname gets real bit of path (from start, or last match)
                $subname .= $addition;
                // start a series of tests to match the right leaf
                $matched_path = rtrim($subname, Constantly::DIR_SEPARATOR_URL);
                $matched_leaf = false;
                // see if there's a directory metadata file
                MetadataFileReader::readSettingsFile($this->settings, $matched_path . Constantly::DIR_SEPARATOR_URL . Constantly::DIR_METADATA_FILENAME);
                if (isset($this->settings[Constantly::DIR_METADATA_SECTION])) {
                    if (isset($this->settings[Constantly::DIR_METADATA_SECTION]['IconFile'])) {
                        $matched_leaf = $this->settings[Constantly::DIR_METADATA_SECTION]['IconFile'];
                    }
                }
                // else, find file using path and match (e.g. [i1])
                if ($matched_leaf === false) {
                    // strip trailing slash because findFind works off either a directory/zip
                    $matched_leaf = $this->findFile($matched_path, $match[0]);
                }
                // else, if we couldn't find the first image [iX]
                if (($matched_leaf === false) && ($match[0][0] == 'i')) {
                    // try to search under first entity [1] (top-level dir zip case)
                    $matched_leaf = $this->findFile($matched_path, 1);
                    if ($matched_leaf !== false) {
                        // if we found a first entity, append it to subname
                        $subname .= $matched_leaf . Constantly::DIR_SEPARATOR_URL;
                        $matched_path = rtrim($subname, Constantly::DIR_SEPARATOR_URL);
                        // then search again for the original [iX]
                        $matched_leaf = $this->findFile($matched_path, $match[0]);
                    }
                }
                // check if we found anything
                if ($matched_leaf === false) {
                    // fail, unable to find that file
                    throw $this->createNotFoundException('Unable to find a file matching those parameters');
                } else {
                    // add found file to path
                    $subname .= $matched_leaf;
                }
                $lastpos = $match[1] + 1 + strlen($match[0]);
            }
            // attach remainder (unprocessed part) of filename after last match
            $addition = substr($filename, $lastpos, strlen($filename) - $lastpos);;
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

    public function findFile($filepath, $match)
    {
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
            $enttype = $entry->getType();
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
                    return $entry->getName();
                }
            } else if ($match_type == $enttype) {
                if ($match == $type_counter[$enttype]) {
                    return $entry->getName();
                }
            }
        }
        return false;
    }

    /**
     * Note: all URLs go through this function (or internal version below) to become filenames
     * @return Filename without trailing slash
     */

    public function convertRawToFilename($name)
    {
        // convert utf8 to iso-8859-1
        $name = iconv("utf-8", "iso-8859-1//ignore", $name);
        // strip off index.html if set
        $name = preg_replace('/' . Constantly::DIR_INDEX_FILENAME . '$/', '', $name);
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
            } else if (isset($_SERVER['PWD'])) {
                // use php pwd
                $filename = rtrim($_SERVER['PWD'], Constantly::DIR_SEPARATOR_URL) . str_repeat(Constantly::DIR_SEPARATOR_URL . '..', 2);
            } else if (isset($_SERVER['argv'][2])) {
                $config_file = str_replace('\\', Constantly::DIR_SEPARATOR_URL, $_SERVER['argv'][2]);
                $config_file_pos = strpos($config_file, 'app' . Constantly::DIR_SEPARATOR_URL . 'phpunit.xml.dist');
                if ($config_file_pos) {
                    // use configuration file argument (Oh look, a straw to clutch at!)
                    $filename = rtrim(substr($config_file, 0, $config_file_pos), Constantly::DIR_SEPARATOR_URL) . str_repeat(Constantly::DIR_SEPARATOR_URL . '..', 2);
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
    public function convertRawToInternalFilename($name)
    {
        return $this->convertRawToFilename(Constantly::FOLDER_NAME . Constantly::DIR_SEPARATOR_URL . $name);
    }

    /**
     * turn off caching, usually as a result of a detected error in the writeable cache folder
     */
    public function disableCaching()
    {
        // single args object, so use it to disable caching
        $this->args->setCache(false);
        // @todo remove; not sure this works because we end up with copies of the settings array
        $this->settings['general']['nocache'] = 'nocache';
    }

    /**
     * @param string $message Simple text error message
     * channel all calls through here so eventually we can do something clever
     */
    public function error($message, $fatal = false)
    {
        if ($fatal) {
            print $message;
            exit;
        }
        if ($this->errbuf === null) {
            $this->errbuf = array();
        }
        $this->errbuf[] = $message . '<br />' . "\r\n";
        // return an error message if we're not rendering an image
        if (!is_a($this, 'Lightenna\StructuredBundle\Controller\ImageviewController')) {
            // @todo remove
            // currently this is handled by the ImageviewController not calling flush
        }
    }

    /**
     * @return array list of errors accumulated
     */
    public function getErrors()
    {
        return $this->errbuf;
    }

    /**
     * Output an image with correct headers
     * @param string $imgdata Raw image data as a string
     * @return Response image data returned in Symfony Response wrapper
     */
    protected function returnImage($imgdata)
    {
        $ext = 'jpeg';
        if (isset($this->{'entry'})) {
            $ext = $this->entry->getExt();
        }
        if (!headers_sent()) {
            header("Content-Type: image/" . $ext);
            header("Content-Length: " . strlen($imgdata));
        }
        return new Response($imgdata);
    }

    protected function getParameterOrDefault($name, $default)
    {
        $param_value = $this->request->get($name);
        if ($param_value === null) {
            $param_value = $default;
        }
        return $param_value;
    }

    public function getRouteType($default)
    {
        // pull from route name (e.g. lightenna_filecacherefresh_id -> filecacherefresh)
        $route_type = explode('_', $this->request->get('_route'));
        if (isset($route_type[1])) {
            return $route_type[1];
        } else {
            return $default;
        }
        return $route_type;
    }

    /**
     * @return URL name without trailing slash
     */
    static function convertRawToUrl($name)
    {
        // strip off index.html if set
        $name = preg_replace('/' . Constantly::DIR_INDEX_FILENAME . '$/', '', $name);
        // strip slash from both ends
        $name = trim($name, Constantly::DIR_SEPARATOR_URL);
        // return with starting slash only
        return Constantly::DIR_SEPARATOR_URL . $name;
    }

    static function serialiseListing($listing)
    {
        $encoders = array(new XmlEncoder(), new JsonEncoder());
        $normalizers = array(new GetSetMethodNormalizer());
        $igFields = array_merge(ImageMetadata::getIgnoredAttributes(), GenericEntry::getIgnoredAttributes());
        $normalizers[0]->setIgnoredAttributes($igFields);
        $serializer = new Serializer($normalizers, $encoders);
        $jsonContent = $serializer->serialize($listing, 'json');
        return $jsonContent;
    }

    public function deserialiseListing($serial_json)
    {
        $serial = array();
        $encoders = array(new XmlEncoder(), new JsonEncoder());
        $normalizers = array(new GetSetMethodNormalizer());
        $igFields = array_merge(ImageMetadata::getIgnoredAttributes(), GenericEntry::getIgnoredAttributes(), EntryLayout::getIgnoredAttributes());
        $normalizers[0]->setIgnoredAttributes($igFields);
        $serializer = new Serializer($normalizers, $encoders);
        // use two-stage deserialize to cope with array of objects
        $serial_array = $serializer->decode($serial_json, 'json');
        foreach ($serial_array as $sjs) {#
            $entry = $serializer->denormalize($sjs, 'Lightenna\StructuredBundle\Entity\GenericEntry', 'json');
            // properly deserialize the sub-objects inside it
            $entry->setMetadata($serializer->denormalize($entry->getMetadata(), 'Lightenna\StructuredBundle\Entity\ImageMetadata', 'json'));
            $entry->setEntryLayout($serializer->denormalize($entry->getEntryLayout(), 'Lightenna\StructuredBundle\Entity\EntryLayout', 'json'));
            // reinflate the MetadataFileReader
            $filename = $this->convertRawToFilename($entry->getRawname());
            $mfr = new CachedMetadataFileReader($filename, $this);
            $entry->setMetadataFileReader($mfr);
            $mfr->setGenericEntry($entry);
            // store the entry in the output array
            $serial[] = $entry;
        }
        return $serial;
    }

}
