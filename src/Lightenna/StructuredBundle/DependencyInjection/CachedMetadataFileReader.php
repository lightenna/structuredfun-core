<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class CachedMetadataFileReader extends MetadataFileReader {

  var $cache;
  var $stats;
  var $args;
  var $settings;

  public function __construct($filename = null, $con) {
    parent::__construct($filename, $con);
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
    $this->args = $this->controller->getArgs();
  }

  /**
   * Test to see if we can use the cache
   * @return boolean True if cache is enabled
   */

  public function cacheIsEnabled() {
    if (isset($this->settings['nocache']) || isset($this->args['nocache'])) {
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
   * For now this is based on name-only
   * @todo incorporate file modified date into hash
   * @return string A cache key based on the file's metadata
   */

  public function getKey() {
    $cachestring = $this->stats->file;
    $cachestring .= self::flattenKeyArgs($this->args);
    $key = md5($cachestring) . '.' . $this->stats->ext;
    return $key;
  }

  public function get() {
    if ($this->isCached()) {
      return file_get_contents($this->getFilename($this->stats->cachekey));
    }
    else {
      return parent::get();
    }
  }

  /**
   * Rewrite the current file's path
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
      'maxheight'
    );
    foreach ($keys as $key) {
      if (isset($args[$key])) {
        $output .= $key . $args[$key];
      }
    }
    return $output;
  }

}
