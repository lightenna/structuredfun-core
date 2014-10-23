<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;
class MetadataFileReader extends FileReader {

  protected $stats;
  protected $args;
  protected $settings;
  protected $controller;
  protected $metadata;
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
    $this->metadata = new Metadata($this, $this->stats);
  }

  /**
   * Get the contents of a file, then load available metadata
   * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::get()
   */
  public function get() {
    $imgdata = parent::get();
    if ($imgdata) {
      $this->readImageMetadata($imgdata);
    }
    return $imgdata;
  }

  /**
   * Pull metadata from this image data block and store in stats
   * @param string $imgdata Image file as a string
   * @return object processed metadata object
   */
  public function readImageMetadata($imgdata) {
    // read metadata
    $info = array();
    // test (fast) if imgdata length > 0
    if (isset($imgdata[1])) {
      // can't use getimagesizefromstring as php > 5.4.0, so redirect via file wrapper
      $uri = 'data://application/octet-stream;base64,' . base64_encode($imgdata);
      $mdata = getimagesize($uri, $info);
    } else {
      print('Error: problem reading '.$this->file_part_leaf.', length '.strlen($imgdata).' bytes'."<br />\r\n");
    }
    // could potentially get back a new metadata object if unserialized
    $this->metadata = $this->metadata->read($info);
    // store metadata block in stats for controller
    $this->stats->{'meta'} = $this->metadata;
    // return object
    return $this->metadata;
  }

  /**
   * @return object return metadata object
   */
  public function getMetadata() {
    return $this->metadata;
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
      foreach ($listing as $obj) {
        $this->parseDirectoryEntry($obj);
      }
    }
    // add in shares within this folder
    if (!is_null($this->name) && isset($this->settings['attach'][ltrim($this->name, DIR_SEPARATOR)])) {
      $shares = $this->settings['attach'][ltrim($this->name, DIR_SEPARATOR)];
      foreach ($shares as $k => &$sh) {
        $newentry = new \stdClass();
        $newentry->{'name'} = $sh['name'];
        $newentry->{'alias'} = (isset($sh['alias']) ? $sh['alias'] : $sh['name']);
        $newentry->{'type'} = 'directory';
        $newentry->{'orientation'} = 'x';
        $newentry->{'hidden'} = '';
        $newentry->{'ext'} = '';
        $newentry->{'path'} = $newentry->{'file'} = $newentry->{'file_original'} = $sh['path'];
        $listing[] = $newentry;
      }
    }
    if ($this->isDirectory()) {
      // sort directory based on entry type
      usort($listing, function($a, $b) {
        $typeorder = array('image', 'directory', 'genfile');
        $refa = array_search($a->type, $typeorder);
        $refb = array_search($b->type, $typeorder);
        if ($refa == $refb) {
          return ($a->name < $b->name) ? -1 : 1;
        }
        return ($refa < $refb) ? -1 : 1;
      });
      // finally add sequence number to each directory entry
      $seq = 0;
      foreach ($listing as $obj) {
        // add sequence number (zero-based; dense, not sparse; includes non-images)
        $obj->{'seq'} = $seq++;
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
    // try and use metadata first
    if (isset($obj->meta->orientation)) {
      return $obj->meta->orientation;
    }
    // assume landscape if there's a problem reading
    if ($imgdata == null)
      return 'x';
    if (!self::checkImageDatastream($imgdata))
      return 'x';
    // create an image, then read out the width and height
    $img = @imagecreatefromstring($imgdata);
    if ($img) {
      if (imagesx($img) < imagesy($img))
        return 'y';
    }
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

}
