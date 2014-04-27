<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
class MetadataFileReader extends FileReader {

  protected $stats;
  protected $args;
  protected $settings;
  protected $controller;
  protected $name = null;
  
  public function __construct($filename, $con) {
    parent::__construct($filename);
    $this->controller = $con;
    $this->args = $this->controller->getArgs();
    $this->stats = new \stdClass();
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
    $this->getImageMetadata();
    return $imgdata;
  }

  /**
   * Pull metadata from this file and store in stats
   */
  public function getImageMetadata() {
// print('***CALLED***');
    // read metadata
    $info = array();
    if (function_exists('getimagesizefromstring')) {
      // read from stream; more efficient but requires php 5.4
      getimagesizefromstring($imgdata, $info);
    } else {
      // php 5 where image is stored as a file
      if (!$this->inZip()) {
        getimagesize($this->file_part, $info);
      }
    }
    // if metadata has IPTC fields
    if (isset($info['APP13'])) {
      $iptc = new IptcWriter();
      $iptc->prime(iptcparse($info['APP13']));
      $this->stats->{'meta'} = unserialize($iptc->get(IPTC_SPECIAL_INSTRUCTIONS));
    }
  }
  
  /**
   * Can't remember what this does
   * @param string $n URL name
   */
  public function injectShares($n) {
    $this->name = $n;
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
        // add sequence number
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
      $imgdata = $localmfr->getOnlyIfCached();
// print_r($localmfr->getStats());
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
   * Rewrite the current file's path
   * @todo may need to tweak for things in zips
   */
  
  public function rewrite($newname) {
    parent::rewrite($newname);
    $this->stats->file = $newname;
    $this->stats->ext = self::getExtension($this->stats->file);
    return $newname;
  }
  
}
