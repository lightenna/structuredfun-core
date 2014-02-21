<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use Lightenna\StructuredBundle\DependencyInjection\CacheHelper;

class CachedMetadataFileReader extends MetadataFileReader {

  var $cache;
  var $stats;
  var $args;
  var $settings;

  public function __construct($filename, $con) {
    parent::__construct($filename, $con);
    $this->getListing();
    $this->settings = $this->controller->getSettings();
    $this->cache = new CacheHelper($this->settings, $this->controller);
    $this->cachedir = $this->controller->convertRawToInternalFilename($this->settings['mediacache']['path']);
    // create cache directory if it's not already present
    if (!is_dir($this->cachedir)) {
      mkdir($this->cachedir);
    }
    $this->stats = $this->getStats();
    $this->args = $this->controller->getArgs();
    $this->stats->cachekey = $this->cache->getKey($this->stats, $this->args);
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
  
  public function isCached() {
    // if the image file exists in the (enabled) cache at the requested size, return it
    return $this->cacheIsEnabled() && $this->cache->exists($this->stats->cachekey);
  }
  
  public function get() {
    if ($this->isCached()) {
      return $this->cache->get($this->stats->cachekey);
    } else {
      return parent::get();
    }
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
