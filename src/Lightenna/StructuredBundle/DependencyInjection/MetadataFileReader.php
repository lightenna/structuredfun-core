<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
class MetadataFileReader extends FileReader {

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
    $obj->orientation = 'x';
    return $obj;
  }
}
