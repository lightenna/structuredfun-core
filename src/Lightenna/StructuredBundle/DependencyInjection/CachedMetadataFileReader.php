<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use Lightenna\StructuredBundle\DependencyInjection\CacheHelper;

class CachedMetadataFileReader extends MetadataFileReader {

  var $cache;
  var $stats;
  var $args;

  public function __construct($filename, $controller) {
    parent::__construct($filename);
    $this->getListing();
    $this->cache = new CacheHelper($controller->getSettings(), $controller);
    $settings = $controller->getSettings();
    $this->cachedir = $controller->convertRawToInternalFilename($settings['mediacache']['path']);
    // create cache directory if it's not already present
    if (!is_dir($this->cachedir)) {
      mkdir($this->cachedir);
    }
    $this->stats = $this->getStats();
    $this->args = $controller->getArgs();
    $this->stats->cachekey = $this->cache->getKey($this->stats, $this->args);
  }

  public function isCached() {
    // if the image file exists in the cache at the requested size, return it
    return $this->cache->exists($this->stats->cachekey);
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
