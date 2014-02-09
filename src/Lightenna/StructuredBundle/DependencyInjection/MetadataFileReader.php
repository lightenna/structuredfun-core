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
    // get the image metadata to calculate display properties
    $obj->orientation = $this->getOrientation($obj);
    return $obj;
  }

  /**
   * Work out the orientation of the image
   * @return string orientation (x|y)
   */

  public function getOrientation($obj) {
    $imgdata = null;
    // $localmfr = new CachedMetadataFileReader($obj->file, $this->controller);
    // $imgdata = $localmfr->get();
    if ($imgdata == null)
      return 'x';
    $img = imagecreatefromstring($imgdata);
    if (imagesx($img) < imagesy($img))
      return 'y';
    return 'x';
  }

}
