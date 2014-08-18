<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;
class MetadataFileReader extends FileReader {

  protected $stats;
  protected $args;
  protected $settings;
  protected $controller;
  protected $name = null;
  
  public function __construct($filename, $con) {
    parent::__construct($filename);
    $this->controller = $con;
    $this->stats = new \stdClass();
    $this->setArgs($this->controller->getArgs());
    $this->settings = $this->controller->getSettings();
    if (!is_null($filename)) {
      $this->getListing();
      $this->stats = $this->getStats();
    }
  }

  /**
   * Get the contents of a file, then load available metadata
   * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::get()
   */
  public function get() {
    $imgdata = parent::get();
    if ($imgdata) {
      $this->getImageMetadata($imgdata);
    }
    return $imgdata;
  }

  /**
   * Pull metadata from this file and store in stats
   * @param string $imgdata Image file as a string
   * @return object processed metadata object
   */
  public function getImageMetadata($imgdata) {
    // read metadata
    $info = array();
    // can't use getimagesizefromstring as php > 5.4.0, so redirect via file wrapper
    $uri = 'data://application/octet-stream;base64,' . base64_encode($imgdata);
    $mdata = getimagesize($uri, $info);
    $this->processRawMetadata($info);
  }

  /**
   * Process raw output from getimagesize()
   * @param array $info
   */
  function processRawMetadata($info) {
    // if metadata has IPTC fields
    if (isset($info['APP13'])) {
      $iptc = new IptcWriter();
      $iptc->prime(iptcparse($info['APP13']));
      // silence warning
      $iptc_special = $iptc->get(IPTC_SPECIAL_INSTRUCTIONS);
      $this->stats->{'meta'} = @unserialize($iptc_special);
      if ($this->stats->{'meta'} === false) {
        $this->stats->{'meta'} = new \stdClass();
      }
    }
  }
  
  /**
   * Overriden getListing function that adds metadata to the elements
   * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::getListing()
   */

  public function getListing() {
    $listing = parent::getListing();
    // loop through each obj (object refs have implicit &$obj)
    foreach ($listing as $obj) {
      $this->parseObject($obj);
    }
    if ($this->isDirectory()) {
      // if we're processing a directory, loop through files and pull their metadata 
      $seq = 0;
      foreach ($listing as $obj) {
        $this->parseDirectoryEntry($obj);
        // add sequence number (zero-based; dense, not sparse; includes non-images)
        $obj->{'seq'} = $seq++;
      }
    }
    // add in shares within this folder
    if (!is_null($this->name) && isset($this->settings['attach'][ltrim($this->name, DIR_SEPARATOR)])) {
      $shares = $this->settings['attach'][ltrim($this->name, DIR_SEPARATOR)];
      foreach ($shares as $k => &$sh) {
        $newentry = array(
          'name' => $sh['name'],
          'alias' => (isset($sh['alias']) ? $sh['alias'] : $sh['name']),
          'type' => 'directory',
          'orientation' => 'x',
          'hidden' => '',
          'ext' => '',
          'seq' => $seq++,
        );
        $newentry['path'] = $newentry['file'] = $newentry['file_original'] = $sh['path'];
        $listing[] = $newentry;
      }
    }
    return $listing;
  }

  /**
   * Work out the orientation of the current or a named image
   * @return string orientation (x|y)
   */

  public function getOrientation($obj = null) {
    if (is_null($obj)) {
      $imgdata = $this->get();
    }
    else {
      $imgdata = null;
      $filename = $this->getFullname($obj);
      $localmfr = new CachedMetadataFileReader($filename, $this->controller);
      // local reader needs to use this reader's args (to get correctly size-cached thumbnails) 
      $localmfr->setArgs($this->args);
      $imgdata = $localmfr->getOnlyIfCached();
      // @todo this print_r exposes that we're calling it twice
      $localstats = $localmfr->getStats();
      // transfer metadata from cached copy to this directory entry
      if (isset($localstats->{'cachekey'})) {
        $obj->cachekey = $localstats->{'cachekey'};
      }
      if (isset($localstats->{'meta'})) {
        $obj->meta = $localstats->meta;
      }
    }
    // assume landscape if there's a problem reading
    if ($imgdata == null)
      return 'x';
    if (!self::checkImageDatastream($imgdata))
      return 'x';
    // create an image, then read out the width and height
    $img = imagecreatefromstring($imgdata);
    if (imagesx($img) < imagesy($img))
      return 'y';
    return 'x';
  }

  /**
   * Can't remember what this does
   * @param string $n URL name
   */
  public function injectShares($n) {
    $this->name = $n;
  }
  
  /**
   * Add metadata fields to object
   * @param Object $obj Listing object
   */

  public function parseObject($obj) {
    $obj->{'ext'} = self::getExtension($obj->{'name'});
    // catch hidden files
    if ($obj->{'name'}[0] == '.') {
      $obj->{'hidden'} = true;
    }
    // type image based on extension
    switch (strtolower($obj->{'ext'})) {
      case 'png':
      case 'jpeg':
      case 'jpg':
      case 'gif':
        $obj->{'type'} = 'image';
        break;
      case 'mp4':
      case 'm4v':
      case 'avi':
      case 'flv':
        $obj->{'type'} = 'video';
        break;
      case 'zip':
        $obj->{'type'} = 'directory';
        break;
    }
    return $obj;
  }

  /**
   * Add metadata fields to directory entries
   * @param Object $obj Listing object
   */

  public function parseDirectoryEntry($obj) {
    switch ($obj->{'type'}) {
      case 'image':
        // get the image metadata by reading (cached-only) file
        // fast enough (110ms for 91 images)
        $obj->orientation = $this->getOrientation($obj);
        break;
      case 'video':
        // assume all video is landscape
        $obj->orientation = 'x';
        break;
      default:
        $obj->orientation = 'x';
        break;
    }
    return $obj;
  }

  /**
   * Set the arguments for this file reader
   * @param object $args
   */
  public function setArgs($args) {
    $this->args = $args;
  }
  
  /**
   * Add arguments to our argument array
   * Arguments influence the cachestring in the CachedMetadataFileReader
   * @param object $args
   */
  public function injectArgs($args) {
    $this->args = (object) array_merge((array) $this->args, (array) $args);
  }
  
  /**
   * Rewrite the current file's path
   * @todo may need to tweak for things in zips
   */
  
  public function rewrite($newname) {
    parent::rewrite($newname);
    $this->stats->file = $newname;
    // don't rewrite its extension because we don't use that for file access, only for type detection
    // $this->stats->ext = self::getExtension($this->stats->file);
    return $newname;
  }

  /**
   * Select and rename a few of the stats fields for storing as image metadata
   * @param object $in
   * @return object Filtered and renamed metadata
   */
  public function filterStatsForMetadata($in) {
    $out = new \stdClass();
    $out->width = $in->width;
    $out->height = $in->height;
    $out->width_loaded = $in->newwidth;
    $out->height_loaded = $in->newheight;
    // round to 5DP (0.1px for a 10k image)
    $out->ratio = round($out->width_loaded / $out->height_loaded, 5);
    return $out;
  }
  
}
