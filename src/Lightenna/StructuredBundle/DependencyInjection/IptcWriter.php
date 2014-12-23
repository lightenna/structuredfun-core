<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

// http://www.exiv2.org/iptc.html
define('IPTC_OBJECT_NAME', '005');
define('IPTC_EDIT_STATUS', '007');
define('IPTC_PRIORITY', '010');
define('IPTC_CATEGORY', '015');
define('IPTC_SUPPLEMENTAL_CATEGORY', '020');
define('IPTC_FIXTURE_IDENTIFIER', '022');
define('IPTC_KEYWORDS', '025');
define('IPTC_RELEASE_DATE', '030');
define('IPTC_RELEASE_TIME', '035');
define('IPTC_SPECIAL_INSTRUCTIONS', '040');
define('IPTC_REFERENCE_SERVICE', '045');
define('IPTC_REFERENCE_DATE', '047');
define('IPTC_REFERENCE_NUMBER', '050');
define('IPTC_CREATED_DATE', '055');
define('IPTC_CREATED_TIME', '060');
define('IPTC_ORIGINATING_PROGRAM', '065');
define('IPTC_PROGRAM_VERSION', '070');
define('IPTC_OBJECT_CYCLE', '075');
define('IPTC_BYLINE', '080');
define('IPTC_BYLINE_TITLE', '085');
define('IPTC_CITY', '090');
define('IPTC_PROVINCE_STATE', '095');
define('IPTC_COUNTRY_CODE', '100');
define('IPTC_COUNTRY', '101');
define('IPTC_ORIGINAL_TRANSMISSION_REFERENCE',     '103');
define('IPTC_HEADLINE', '105');
define('IPTC_CREDIT', '110');
define('IPTC_SOURCE', '115');
define('IPTC_COPYRIGHT_STRING', '116');
define('IPTC_CAPTION', '120');
define('IPTC_LOCAL_CAPTION', '121');

class IptcWriter {

  protected $meta;
  protected $filename;

  public function __construct($f = null) {
    $this->filename = $f;
    if (!is_null($this->filename)) {
      $this->reload($this->filename);      
    }
  }

  public function prime($arr) {
    $this->meta = $arr;
  }

  public function set($name, $data) {
    $this->meta['2#'.$name] = Array( $data );
  }

  public function get($name) {
    return isset($this->meta['2#'.$name]) ? $this->meta['2#'.$name][0] : false;
  }

  public function getAll() {
    return $this->meta;
  }
  
  public function reload($path) {
    $img = getimagesize($path, $info);
    if (isset($info['APP13'])) {
      $this->meta = iptcparse($info['APP13']);
    }
  }

  private function serialiseAsIPTC() {
    $data = '';
    foreach($this->meta as $name => $value) {
      $key = substr($name, 2);
      $data .= $this->makeTag(2, $key, $value[0]);
    }
    return $data;    
  }

  /**
   * @param  string $imgdata image data to pull IPTC from
   */
  public function loadFromStream(&$imgdata) {
    $uri = 'data://application/octet-stream;base64,' . base64_encode($imgdata);
    $this->reload($uri);
  }

  /**
   * @param  string $path path to read image file from
   * @return string image data with embedded IPTC
   */
  public function getStream($path) {
    // load image from file and embed IPTC data
    $imgdata = iptcembed($this->serialiseAsIPTC(), $path);
    return $imgdata;
  }

  public function save($path_override = null) {
    // exit if we haven't setup a file
    if (is_null($this->filename)) {
      return;
    }
    // use initial class path unless override set
    $path = $this->filename;
    if (!is_null($path_override)) {
      $path = $path_override;
    }
    if (count($this->meta)) {
      // load image and embed IPTC data
      $content = $this->getStream($path);
      // write the new image data out to the file.
      $fp = fopen($path, "wb");
      fwrite($fp, $content);
      fclose($fp);    
    }
  }

  private function makeTag($rec, $data, $value) {
    $length = strlen($value);
    $retval = chr(0x1C) . chr($rec) . chr($data);
    if($length < 0x8000)
    {
      $retval .= chr($length >> 8) .  chr($length & 0xFF);
    } else {
      $retval .= chr(0x80) . 
      chr(0x04) . 
      chr(($length >> 24) & 0xFF) . 
      chr(($length >> 16) & 0xFF) . 
      chr(($length >> 8) & 0xFF) . 
      chr($length & 0xFF);
    }
    return $retval . $value;
  }

}

