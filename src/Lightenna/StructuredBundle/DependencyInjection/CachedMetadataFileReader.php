<?php

/**
 * Extra doc
 * ---------
 * When a directory Fileview is requested
 * We create a CachedMetadataFileReader
 *   We append arguments for the thumbnails in that listing
 *   Its MetadataFileReader reads the directory listing
 *     Then we create a CachedMetadataFileReader for each file
 *     Arguments get passed down too, to ensure that we create the same cachestrings
 *     If it's cached, read the file
 *       Its MetadataFileReader then returns metadata for each file
 *     which is used to setup the CSS properly for each thumbnail
 * @author Alex Stanhope <alex_stanhope@hotmail.com>
 */

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class CachedMetadataFileReader extends MetadataFileReader
{

    protected $cache;
    protected $cachedir;

    public function __construct($filename = null, $con)
    {
        parent::__construct($filename, $con);
        $settings = $this->controller->getSettings();
        $this->cachedir = $this->controller->convertRawToInternalFilename('htdocs' . Constantly::DIR_SEPARATOR_URL . 'web' . Constantly::DIR_SEPARATOR_URL . $settings['mediacache']['path'] . Constantly::DIR_SEPARATOR_URL . 'image');
        // create cache directory if it's not already present
        if (!is_dir($this->cachedir)) {
            @mkdir($this->cachedir);
            if (!is_dir($this->cachedir)) {
                // unable to create cache directory, throw nice error
                $this->controller->error('Unable to create cache directory (' . $this->cachedir . ').  Caching temporarily disabled.  Please check filesystem permissions.');
                $this->controller->disableCaching();
            }
        }
        // test cache directory is writeable
        if (!$this->testCacheWrite()) {
            $this->controller->error('Unable to write to cache directory.  Caching temporarily disabled.  Please check filesystem permissions.');
            $this->controller->disableCaching();
        }
        if (!$this->isDirectory()) {
            $this->entry->setCacheKey(null);
            if (!is_null($filename)) {
                $this->entry->setCacheKey($this->getKey());
            }
        }
    }

    /**
     * @return boolean true if we can write to the cache directory
     */
    public function testCacheWrite()
    {
        static $cacheWriteable = null;
        if ($cacheWriteable != null) {
            return $cacheWriteable;
        }
        $filename = $this->getFilenameInCache('.writeable.txt');
        // delete the file if it's already there
        if (file_exists($filename)) {
            @unlink($filename);
        }
        @file_put_contents($filename, '0');
        // if the file is not there afterwards, return a nice error
        if (!file_exists($filename)) {
            $cacheWriteable = false;
        }
        $cacheWriteable = true;
        return $cacheWriteable;
    }

    /**
     * called on first instance of cmfr for optional debugging ops
     */
    public function processDebugSettings()
    {
        $settings = $this->controller->getSettings();
        if (isset($settings['mediacache']['cleareverytime']) && $settings['mediacache']['cleareverytime']) {
            // scrub cache directory
            self::scrubDirectoryContents($this->cachedir);
        }
    }

    /**
     * Test to see if we can use the cache
     * @return boolean True if cache is enabled
     */
    public function cacheIsEnabled()
    {
        $settings = $this->controller->getSettings();
        if (isset($settings['general']['nocache']) || !$this->entry->hasCacheKey()) {
            return false;
        }
        if ($this->args &&  (!$this->args->getCache())) {
            return false;
        }
        return true;
    }

    public function existsInCache($filename = null)
    {
        if (is_null($filename)) {
            $filename = $this->entry->getFile();
        }
        // if the image file exists in the (enabled) cache, return it
        return $this->cacheIsEnabled() && file_exists($filename);
    }

    public function isCached()
    {
        // if the image file is cached at the requested size, return it
        return $this->entry->hasCacheKey() && $this->existsInCache($this->getFilename($this->entry->getCacheKey()));
    }

    public function cacheKeyUpdateable()
    {
        // if the cachekey is set (not a directory) and set with a value (not a null filename)
        return $this->entry->hasCacheKey();
    }

    /**
     * Store the imgdata in the cache if the cache is enabled
     * @param string $imgdata
     * @param boolean $reread_metadata
     * @return true if written to cache
     */
    public function cache(&$imgdata, $reread_metadata = true)
    {
        if ($this->cacheIsEnabled()) {
            if ($reread_metadata) {
                // unless told not to, read metadata from imgdata stream
                $this->readImageMetadata($imgdata);
            }
            // either way update the metadata object with image's current entry data
            $this->metadata->ingestGenericEntry($this->entry);
            // derive full filename from cachekey
            $filename = $this->getFilename($this->entry->getCacheKey());
            // only cache the file if it's not already in the cache
            if (!$this->existsInCache($filename)) {
                // detect directory separators in filename
                if (strpos($this->entry->getCacheKey(), Constantly::DIR_SEPARATOR_URL) !== false) {
                    if (!file_exists(dirname($filename))) {
                        mkdir(dirname($filename), '0777', true);
                    }
                }
                // write out file
                file_put_contents($filename, $imgdata);
                if ($this->fileCanHoldMetadata()) {
                    $this->metadata->write($filename);
                } else {
                    // serialize to text file
                    file_put_contents($this->getMetaFilename($filename), $this->metadata->serialize());
                }
                return true;
            }
        }
        return false;
    }

    /**
     * @param  string $filename Filename of image file
     * @return string filename of metadata file
     */
    private function getMetaFilename($filename)
    {
        return self::stripExtension($filename) . '.meta';
    }

    /**
     * @return true if this type of file can hold IPTC metadata in it
     */
    public function fileCanHoldMetadata()
    {
        switch (strtolower($this->entry->getExt())) {
            case 'jpeg' :
            case 'jpg' :
            default :
                return true;
            case 'gif' :
                return false;
        }
    }

    /**
     * For now this is based on name-only
     * @todo incorporate file modified date into hash
     * @return string A cache key based on the file's metadata
     */

    private function getKey()
    {
        $key = '';
        $cachestring = $this->entry->getRawname();
        if ($cachestring == null) {
            $cachestring = $this->getFullname();
        }
        // hash
        $key .= self::hash($cachestring);

        // @todo remove this comment once Argument->getArgs() works
        // don't flatten args, I think because rawname features args now
        // $argstring = self::flattenKeyArgs($this->args);
        // if ($argstring != '') {
        //   $cachestring .= Constantly::ARG_SEPARATOR . $argstring;
        // }

        // don't substitute illegal characters that can be in URLs but can't appear in filenames
        // because it creates a cache miss; instead address upstream
        // $cachestring = str_replace(':', '-', $cachestring);

        // append arguments if we have any
        if ($this->args !== null) {
            $key .= $this->args->getArgString();
        }

        // add .dat to end of the key (filename)
        $key .= '.' . 'dat';
        return $key;
    }

    /**
     * Returns a simple filename for the current file, or its cached alias if key set
     * That means there are cases where it returns:
     *   - the cache path of this file, e.g. if it's been cached already
     *   - the real path of the file, e.g. if it's a directory
     *   - the real file path of a zip file, e.g. if it's a file within a zip
     * @param  string $key cache key, false not to use, true to use pre-existing
     * @return string full path filename of this key'd asset
     */
    public function getFilename($key = false)
    {
        if ($key === true && $this->entry->hasCacheKey()) {
            $key = $this->entry->getCacheKey();
        }
        // if we don't have a cachekey, are reading a directory, or pulling a directory from a zip
        if ($key === false || $this->isDirectory() || ($this->inZip() && $this->zip_part_leaf == null)) {
            // just return the file part
            $fullname = parent::getFilename();
        } else {
            $fullname = $this->getFilenameInCache($key);
        }
        return $fullname;
    }

    /**
     * @param string $key typically a cache key
     * @return string full path filename of this key'd asset
     */
    public function getFilenameInCache($key)
    {
        return $this->cachedir . '/' . $key;
    }

    /**
     * Return the full name of this file, or file within zip, or entry within directory
     * @param $entry directory entry object or null/blank to get our fullname
     * @return Full filename reconstituted from directory entry
     */

    public function getFullname($entry = null)
    {
        if (is_null($entry)) {
            $entry = $this->entry;
        }
        return parent::getFullname($entry);
    }

    /**
     * Get the contents of a file, ideally from the cache
     * Can't save to cache here because the image hasn't been filtered (resized/cropped etc.)
     * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::get()
     */
    public function get()
    {
        if ($this->isCached()) {
            // redirect to use file from cache, but don't change cache key
            $this->rewrite($this->getFilename($this->entry->getCacheKey()), false);
        }
        $imgdata = parent::get();
        return $imgdata;
    }

    /**
     * get all the images in this directory
     * @param array $listing list of directory entries
     * @param boolean $force true to load all the images
     * warning: this will be slow if most of the images aren't cached
     */
    public function getDirectoryAll($listing, $force = false)
    {
        foreach ($listing as &$entry) {
            $image_metadata = $entry->getMetadata();
            // skip directories
            if ($entry->getType() == 'directory') {
                // make directories square by default
                // @todo could resolve subcell images first
                $image_metadata->setStatus(Constantly::IMAGE_STATUS_DIRECTORY);
                $image_metadata->setLoadedWidth(1000);
                $image_metadata->setLoadedHeight(1000);
                $image_metadata->calcRatio();
                continue;
            }
            // memory usage doesn't seem to increase
            // var_dump(memory_get_usage());
            if ($force) {
                // force an image load, resize and cache
                $this->getDirectoryAllCacheThumb($entry);
            }
            // make sure we've got image dimensions
            $rentry = $this->getDirectoryEntryMetadata($entry, $force);
            if ($rentry === null) {
                // failed to load image, substitute error image
                $image_metadata = $entry->getMetadata();
                if (!$image_metadata->hasRatio()) {
                    $image_metadata->setStatus(Constantly::IMAGE_STATUS_MISSING);
                    // assume error image
                    $image_metadata->setLoadedWidth(1340);
                    $image_metadata->setLoadedHeight(1080);
                    $image_metadata->calcRatio();
                }
            }
        }
    }

    /**
     * generate and cache a thumbnail for a given directory entry
     * @param $entry directory [generic] entry
     */
    private function getDirectoryAllCacheThumb($entry)
    {
        $mfr = $this->getDirectoryEntryMetadataFileReader($entry);
        // work out if this obj exists in cache
        if ($mfr->isCached()) {
            // do nothing, already cached
        } else {
            $imgdata = $mfr->get();
            // cache image
            $it = new ImageTransform($this->args, $imgdata, $mfr->getGenericEntry());
            $it->applyFilter();
            $imgdata = $it->getImgdata();
            // cache transformed image
            $mfr->cache($imgdata, false);
        }
    }

    /**
     * Get the contents of a file only if it's in the cache
     * @return string Contents of file, or FALSE on failure
     */
    public function getOnlyIfCached()
    {
        if ($this->isCached()) {
            // not calling parent::get() because want to read cache
            $filename = $this->getFilename($this->entry->getCacheKey());
            $imgdata = file_get_contents($filename);
            if ($this->fileCanHoldMetadata()) {
                // pull metadata manually for cached image
                $this->readImageMetadata($imgdata);
            } else {
                // pull from cached .meta file
                $metaname = $this->getMetaFilename($filename);
                if (file_exists($metaname)) {
                    $md = unserialize(file_get_contents($metaname));
                    $this->entry->setMetadata($md);
                }
            }
            return $imgdata;
        } else {
            return false;
        }
    }

    /**
     * @return path to cache directory
     */
    public function getCachePath()
    {
        return $this->cachedir;
    }

    /**
     * Rewrite the current file's path
     * @todo may need to tweak for things in zips
     */
    public function rewrite($newname, $updateCacheKey = true)
    {
        parent::rewrite($newname);
        // only update cache key if we're not rewriting from the cache
        if ($updateCacheKey) {
            $this->entry->setCacheKey($this->getKey());
        }
        return $newname;
    }

    /**
     * Rewrite the current file's path to the original (not cached) file
     */
    public function rewriteToOriginal()
    {
        $newname = $this->getGenericEntry()->getFileOriginal();
        // dump the cachekey so future gets don't get the cached version again
        $this->entry->setCacheKey(null);
        // rewrite up the chain but don't change cachekey
        return $this->rewrite($newname, false);
    }

    /**
     * Set the arguments for this file reader
     * @param object $args
     */
    public function setArgs($args)
    {
        parent::setArgs($args);
        if ($this->cacheKeyUpdateable()) {
            // update cachekey after messing with args
            $this->entry->setCacheKey($this->getKey());
        }
    }

    /**
     * Add arguments to our argument array
     * Arguments influence the cachestring in the CachedMetadataFileReader
     * @param object $args
     */
    public function mergeArgs($args)
    {
        parent::mergeArgs($args);
        if ($this->cacheKeyUpdateable()) {
            // update cachekey after messing with args
            $this->entry->setCacheKey($this->getKey());
        }
    }

    /**
     * Generate hash in a standard way
     *   we never dehash, but always hash and compare
     * @param string $key plaintext
     * @return string hashed string
     */
    static function hash($key)
    {
        // return str_replace(str_split('\\/:*?"<>|'), Constantly::DIR_SEPARATOR_ALIAS, $key);
        return str_replace(Constantly::DIR_SEPARATOR_URL, Constantly::DIR_SEPARATOR_ALIAS, $key);
        // used to use md5, experimenting with readable alternative
        // return md5($key);
    }

    /**
     * Maintain symmetric functions
     * hash() used by cache
     * reverse_hash() used by view controller when receiving URLs
     */
    static function reverse_hash($key)
    {
        return str_replace(Constantly::DIR_SEPARATOR_ALIAS, Constantly::DIR_SEPARATOR_URL, $key);
    }

    static function scrubDirectoryContents($dir)
    {
        // get directory listing
        $listing = scandir($dir);
        foreach ($listing as $k => $v) {
            // ignore directory references or empty file names
            if ($v == '.' || $v == '..' || $v == '') {
                unset($listing[$k]);
                continue;
            }
            // delete the file
            unlink($dir . Constantly::DIR_SEPARATOR_URL . $v);
        }
    }
}
