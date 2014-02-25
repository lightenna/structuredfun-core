<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
class MetadataFileReader extends FileReader {

  protected $controller;

  public function __construct($filename, $con) {
    parent::__construct($filename);
    $this->controller = $con;
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
        $obj->orientation = 'none';
        // getting the image metadata by reading file is too slow to calculate display properties
        // $obj->orientation = $this->getOrientation($obj);
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
      $localmfr = new FileReader($filename, $this->controller);
      $imgdata = $localmfr->get();
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

}
