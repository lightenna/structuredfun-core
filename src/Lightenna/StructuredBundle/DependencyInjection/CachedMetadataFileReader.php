<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class CachedMetadataFileReader extends MetadataFileReader {

  var $cache;
  var $stats;
  var $args;
  var $settings;
  var $name = null;

  public function __construct($filename = null, $con) {
    parent::__construct($filename, $con);
    $this->args = $this->controller->getArgs();
    $this->stats = new \stdClass();
    $this->settings = $this->controller->getSettings();
    $this->cachedir = $this->controller->convertRawToInternalFilename($this->settings['mediacache']['path']);
    // create cache directory if it's not already present
    if (!is_dir($this->cachedir)) {
      mkdir($this->cachedir);
    }
    if (!is_null($filename)) {
      $this->getListing();
      $this->stats = $this->getStats();
      $this->stats->cachekey = $this->getKey();
    }
  }

  public function injectShares($n) {
    $this->name = $n;
  }
  
  /**
   * Overriden getListing function that adds metadata to the elements
   * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::getListing()
   */

  public function getListing() {
    $listing = parent::getListing();
    // add in shares within this folder
    if (!is_null($this->name) && isset($this->settings['attach'][ltrim($this->name, DIR_SEPARATOR)])) {
      $shares = $this->settings['attach'][ltrim($this->name, DIR_SEPARATOR)];
      foreach ($shares as $k => &$sh) {
        $newentry = array(
          'name' => $sh['name'],
          'alias' => $sh['alias'],
          'type' => 'directory',
          'orientation' => 'x',
        );
        $newentry['path'] = $newentry['file'] = $newentry['file_original'] = $sh['path'];
        $listing[] = $newentry;
      }
    }
    return $listing;
  }

  /**
   * Test to see if we can use the cache
   * @return boolean True if cache is enabled
   */

  public function cacheIsEnabled() {
    if (isset($this->settings['general']['nocache']) || isset($this->args['nocache'])) {
      return false;
    }
    return true;
  }

  public function existsInCache($filename = null) {
    if (is_null($filename)) {
      $filename = $this->stats->file;
    }
    // if the image file exists in the (enabled) cache, return it
    return $this->cacheIsEnabled() && file_exists($filename);
  }

  public function isCached() {
    // if the image file is cached at the requested size, return it
    return isset($this->stats->{'cachekey'}) && $this->existsInCache($this->getFilename($this->stats->cachekey));
  }

  /**
   * Store the imgdata in the cache
   * @param string $imgdata
   * @return string the source image data, passed through
   */
  public function cache(&$imgdata) {
    if ($this->cacheIsEnabled()) {
      $filename = $this->getFilename($this->stats->cachekey);
      return file_put_contents($filename, $imgdata);
    } else {
      return false;
    }
  }
  
  /**
   * For now this is based on name-only
   * @todo incorporate file modified date into hash
   * @return string A cache key based on the file's metadata
   */

  public function getKey() {
    $cachestring = $this->getFullname();
    $argstring = self::flattenKeyArgs($this->args);
    if ($argstring != '') {
      $cachestring .= ARG_SEPARATOR . $argstring;
    }
    $key = md5($cachestring) . '.' . $this->stats->ext;
    return $key;
  }

  /**
   * @param $obj directory entry object or null/blank to get our fullname 
   * @return Full filename reconstituted from directory entry
   */
  
  public function getFullname($obj = null) {
    if (is_null($obj)) {
      $obj = $this->stats;
    }
    return parent::getFullname($obj);
  }
  
  /**
   * Get the contents of a file, ideally from the cache
   * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::get()
   */
  public function get() {
    if ($this->isCached()) {
      return file_get_contents($this->getFilename($this->stats->cachekey));
    }
    else {
      $imgdata = parent::get();
      // can't cache here because the image hasn't been filtered (resized/cropped etc.)
      // $this->cache($imgdata);
      return $imgdata;
    }
  }

  /**
   * Get the contents of a file only if it's in the cache
   * @return string Contents of file, or FALSE on failure
   */
  public function getOnlyIfCached() {
    if ($this->isCached()) {
      return file_get_contents($this->getFilename($this->stats->cachekey));
    }
    else {
      return false;
    }
  }

  /**
   * Rewrite the current file's path
   * @todo may need to tweak for things in zips
   */

  public function rewrite($newname) {
    parent::rewrite($newname);
    $this->stats->file = $newname;
    $this->stats->ext = self::getExtension($this->stats->file);
    // update cache key
    $this->stats->cachekey = $this->getKey();
    return $newname;
  }

  /**
   * @param  string $key cache key
   * @return string full path filename of this key'd asset
   */

  public function getFilename($key) {
    return $this->cachedir . '/' . $key;
  }

  static function hash($key) {
    return md5($key);
  }

  /**
   * Create a string to uniquely identify these image arguments
   * @param  array $args URL arguments
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
    );
    foreach ($keys as $key) {
      if (isset($args[$key])) {
        $output .= $key . '=' . $args[$key];
      }
    }
    return $output;
  }

}
