<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class CachedMetadataFileReader extends MetadataFileReader {

  protected $cache;
  protected $cachedir;

  public function __construct($filename = null, $con) {
    parent::__construct($filename, $con);
    $this->cachedir = $this->controller->convertRawToInternalFilename($this->settings['mediacache']['path']);
    // create cache directory if it's not already present
    if (!is_dir($this->cachedir)) {
      mkdir($this->cachedir);
    }
    $this->stats->cachekey = null;
    if (!is_null($filename)) {
      $this->stats->cachekey = $this->getKey();
    }
  }

  /**
   * Test to see if we can use the cache
   * @return boolean True if cache is enabled
   */

  public function cacheIsEnabled() {
    if (isset($this->settings['general']['nocache']) || isset($this->args->{'nocache'}) || is_null($this->stats->cachekey)) {
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
    return !is_null($this->stats->{'cachekey'}) && $this->existsInCache($this->getFilename($this->stats->cachekey));
  }

  /**
   * Store the imgdata in the cache if the cache is enabled
   * @param string $imgdata
   * @return true if written to cache
   */
  public function cache(&$imgdata) {
    if ($this->cacheIsEnabled()) {
      $filename = $this->getFilename($this->stats->cachekey);
      // only cache the file if it's not already in the cache
      if (!$this->existsInCache($filename)) {
        file_put_contents($filename, $imgdata);
        // @todo make sure this isn't a double write
        $iptc = new IptcWriter($filename);
        $iptc->set(IPTC_SPECIAL_INSTRUCTIONS, serialize($this->stats));
        $iptc->save();
        return true;
      }
    }
    return false;
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
   * Can't save to cache here because the image hasn't been filtered (resized/cropped etc.)
   * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::get()
   */
  public function get() {
    if ($this->isCached()) {
      // redirect to use file from cache, but don't change cache key
      $this->rewrite($this->getFilename($this->stats->cachekey), false);
    }
    $imgdata = parent::get();
    return $imgdata;
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

  public function rewrite($newname, $updateCacheKey = true) {
    parent::rewrite($newname);
    // only update cache key if we're not rewriting from the cache
    if ($updateCacheKey) {
      $this->stats->cachekey = $this->getKey();    
    }
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
   * @param object $args URL arguments
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
      'maxshortest',
    );
    foreach ($keys as $key) {
      if (isset($args->{$key})) {
        $output .= $key . '=' . $args->{$key};
      }
    }
    return $output;
  }

}
