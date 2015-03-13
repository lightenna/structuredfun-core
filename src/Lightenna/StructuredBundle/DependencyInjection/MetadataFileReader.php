<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\Entity\ImageMetadata;
// use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;

class MetadataFileReader extends FileReader {

  protected $stats = null;
  protected $args = null;
  protected $settings = null;
  protected $controller = null;
  protected $metadata = null;
  protected $name = null;

  public function __construct($filename, $con) {
    parent::__construct($filename);
    $this->controller = $con;
    if (!is_null($filename)) {
      // @refactor ; think we can remove this getListing call
      $this->getListing();
      $this->stats = $this->getStats();
    }
    if (!is_object($this->stats)) {
      $this->stats = new GenericEntry();
    }
    $this->stats->setRawname($this->controller->getRawname());
    $this->setArgs($this->controller->getArgs());
    $this->settings = $this->controller->getSettings();
    // assume we're dealing simple Metadata for now (e.g. not Video)
    $this->metadata = new ImageMetadata($this, $this->stats);
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
   * @return array settings
   */
  public function getSettings() {
    return $this->settings;
  }

  public function dumbreadImageMetadata($imgdata) {
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
    $md = new ImageMetadata($this);
    $md = $md->read($mdata, $info);
    return $md;
  }

  /**
   * Pull metadata from this image data block and store in stats
   * @param string $imgdata Image file as a string
   * @return object processed metadata object
   */
  public function readImageMetadata($imgdata) {
    // store metadata block in stats for controller
    $this->metadata = $this->dumbreadImageMetadata($imgdata);
    $this->stats->setMeta($this->metadata);
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
   * @param object $md metadata object
   */
  public function setMetadata($md) {
    $this->metadata = $md;
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
        $obj = new GenericEntry();
        $obj->setName($sh['name']);
        $obj->setAlias(isset($sh['alias']) ? $sh['alias'] : $sh['name']);
        $obj->setType('directory');
        $obj->setPath($sh['path']);
        $obj->setFile($sh['path']);
        $obj->setFileOriginal($sh['path']);
        $listing[] = $obj;
      }
    }
    if ($this->isDirectory()) {
      // sort directory based on entry type
      usort($listing, function($a, $b) {
        $typeorder = array('image', 'directory', 'genfile');
        $refa = array_search($a->getType(), $typeorder);
        $refb = array_search($b->getType(), $typeorder);
        if ($refa == $refb) {
          return ($a->getName() < $b->getName()) ? -1 : 1;
        }
        return ($refa < $refb) ? -1 : 1;
      });
      // finally add sequence number to each directory entry
      $seq = 0;
      foreach ($listing as $obj) {
        // add sequence number (zero-based; dense, not sparse; includes non-images)
        $obj->setSeq($seq++);
      }
    }
    return $listing;
  }

  /**
   * skim function
   * @return array $listing without named fields
   */
  public function skimListing($listing) {
    // dump protected or irrelevant fields
    array_walk($listing, function(&$item, $key) {
      // $dumpList = ['mfr', 'path','file','file_original'];
      // foreach($dumpList as &$dump) {
      //   unset($item->{$dump});
      // }
    });
    return $listing;
  }  

  /**
   * Add metadata fields to directory entries
   * @param Object $obj Listing object
   */

  public function parseDirectoryEntry($obj) {
    switch ($obj->getType()) {
      case 'image':
        // get the image metadata by reading (cached-only) file
        // fast enough (110ms for 91 images)
        $rentry = $this->getDirectoryEntryMetadata($obj);
// delete me
// this is a temporary fix
// while we're sourcing the error upstream
// it's actually making it worse
//    because when the image isn't cached, we make it appear like it is
        // if ($rentry === null) {
        //   // failed to load image, substitute error image
        //   $image_metadata = $obj->getMetadata();
        //   if (!$image_metadata->hasRatio()) {
        //     $image_metadata->setLoadedWidth(1340);
        //     $image_metadata->setLoadedHeight(1080);
        //     $image_metadata->calcRatio();
        //   }
        // }
        break;
      case 'video':
        // get the video metadata by reading (cached-only) file
        $rentry = $this->getDirectoryEntryMetadata($obj);
        break;
      default:
        break;
    }
    return $obj;
  }

  /**
   * Work out the orientation of the current or a named image
   * @param object $obj GenericEntry
   * @param boolean $forceGet true to always load image
   * @return object $obj only used for testing, or null on failure
   */
  public function getDirectoryEntryMetadata($obj = null, $forceGet = false) {
    if (is_null($obj)) {
      $imgdata = $this->get();
      $obj = new GenericEntry();
      $localmeta = $obj->getMetadata();
    }
    else {
      // check to see if we've already got metadata for this entry
      if ($obj->getMetadata()->hasRatio()) {
        return $obj;
      }
      $imgdata = null;
      $filename = $this->getFullname($obj);
      // local reader needs to use this reader's args (to get correctly size-cached thumbnails) 
      $localmfr = new CachedMetadataFileReader($filename, $this->controller);
      // tweak rawname using path from controller but leaf from obj, and args as if first query
      $flat_args = self::flattenKeyArgs($this->args);
      $child_name = $this->controller->getRawname() . DIR_SEPARATOR . $obj->getName() . ARG_SEPARATOR . $flat_args . '&';
      $localmfr->getStats()->setRawname($child_name);
      // setup local reader
      $localmfr->setArgs($this->args);
      $obj->setMetadataFileReader($localmfr);
      // pull out image data
      $imgdata = ($forceGet ? $localmfr->get() : $localmfr->getOnlyIfCached());
      // pull out mfr's metadata
      $localmeta = $localmfr->getMetadata();
      $obj->setMeta($localmeta);
      // @todo this print_r exposes that we're calling it twice
      $localstats = $localmfr->getStats();
      // transfer metadata from cached copy to this directory entry
      if ($localstats->hasCacheKey()) {
        $obj->setCachekey($localstats->getCacheKey());
      }
    }
    // try and use metadata first
    if ($localmeta->hasRatio()) {
      return null;
    }
    // if we don't have the metadata, try and pull from image
    if ($imgdata == null)
      return null;
    if (!self::checkImageDatastream($imgdata))
      return null;
    // create an image, then read out the width and height
    $img = @imagecreatefromstring($imgdata);
    if ($img) {
      $localmeta->setLoadedWidth(imagesx($img));
      $localmeta->setLoadedHeight(imagesy($img));
      $localmeta->calcRatio();
    }
    return $obj;
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
    $name = $obj->getName();
    $obj->setExt(self::getExtension($name));
    // catch hidden files
    if ($name[0] == '.') {
      $obj->setHidden(true);
    }
    // if the listing said it was a generic file
    if ($obj->getType() == 'genfile') {
      // try and match specific-type based on extension
      $extmatch = strtolower($obj->getExt());
      if (in_array($extmatch, explode(',',FILETYPES_IMAGE))) {
        $obj->setType('image');
      }
      else if (in_array($extmatch, explode(',',FILETYPES_VIDEO))) {
        $obj->setType('video');
      }
      else if (in_array($extmatch, explode(',',FILETYPES_ZIP))) {
        $obj->setType('directory');
      }
    } else {
      // others already typed as directory
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
    $this->stats->setFile($newname);
    // don't rewrite its extension because we don't use that for file access, only for type detection
    // $this->stats->ext = self::getExtension($this->stats->file);
    return $newname;
  }

  /**
   * Create a string to uniquely identify these image arguments
   * @param object $args URL arguments
   * @return string arguments as a string
   */
  static function flattenKeyArgs($args) {
    $output = '';
    // if there are no args, they flatten to an empty string
    if (is_null($args))
      return '';
    // only certain args should be used in the cache key
    $keys = array(
      'maxwidth',
      'maxheight',
      'maxlongest',
      'maxshortest',
    );
    foreach ($keys as $key) {
      if (isset($args->{$key})) {
        $output .= $key . '=' . $args->{$key};
      }
    }
    return $output;
  }

}
