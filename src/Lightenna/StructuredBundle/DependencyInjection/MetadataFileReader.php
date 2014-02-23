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
    switch ($obj->{'type'}) {
      case 'image' :
      // case 'video' :
        // get the image metadata to calculate display properties
        $obj->orientation = $this->getOrientation($obj);
        break;
      default:
        $obj->orientation = 'x';
        break;
    }
    return $obj;
  }

  /**
   * Work out the orientation of the image
   * @return string orientation (x|y)
   */

  public function getOrientation($obj) {
    $imgdata = null;
// print('X');
// print_r($obj);
//    return 'x';
    $localmfr = new FileReader($obj->file, $this->controller);
    $imgdata = $localmfr->get();
    return 'x';
    if ($imgdata == null)
      return 'x';
    if (!$localmfr::checkImageDatastream($imgdata))
      return 'x';
    $img = imagecreatefromstring($imgdata);
    if (imagesx($img) < imagesy($img))
      return 'y';
    return 'x';
  }

}
