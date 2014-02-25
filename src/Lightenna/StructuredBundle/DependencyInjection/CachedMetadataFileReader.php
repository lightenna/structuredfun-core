<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use Lightenna\StructuredBundle\DependencyInjection\CacheHelper;

class CachedMetadataFileReader extends MetadataFileReader {

  var $cache;
  var $stats;
  var $args;
  var $settings;

  public function __construct($filename = null, $con) {
    parent::__construct($filename, $con);
    $this->stats = new \stdClass();
    $this->settings = $this->controller->getSettings();
    $this->cache = new CacheHelper($this->settings, $this->controller);
    $this->cachedir = $this->controller->convertRawToInternalFilename($this->settings['mediacache']['path']);
    // create cache directory if it's not already present
    if (!is_dir($this->cachedir)) {
      mkdir($this->cachedir);
    }
    if (!is_null($filename)) {
      $this->getListing();
      $this->stats = $this->getStats();
      $this->stats->cachekey = $this->cache->getKey($this->stats, $this->args);
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
  
  public function existsInCache() {
    // if the image file exists in the (enabled) cache, return it
    return $this->cacheIsEnabled() && file_exists($this->stats->file);
  }
  
  public function isCached() {
    // if the image file is cached at the requested size, return it
    return $this->cacheIsEnabled() && isset($this->stats->{'cachekey'}) && $this->cache->exists($this->stats->cachekey);
  }
  
  public function get() {
    if ($this->isCached()) {
      return $this->cache->get($this->stats->cachekey);
    } else {
      return parent::get();
    }
  }

  /**
   * Rewrite the current file's path
   */
  public function rewrite($newname) {
    parent::rewrite($newname);
    $this->stats->{'file'} = $newname;
    return $newname;
  }
  
  /**
   * @param  string $key cache key
   * @return string full path filename of this key'd asset
   */
  public function getFilename($key) {
    return $this->cachedir.'/'.$key;
  }
  
  static function hash($key) {
    return md5($key);
  }
}
