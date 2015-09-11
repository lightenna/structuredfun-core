<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\Arguments;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class MetadataFileReader extends FileReader
{

    protected $entry = null;
    protected $args = null;
    protected $controller = null;
    protected $metadata = null;
    protected $name = null;

    public function __construct($filename, $con)
    {
        parent::__construct($filename);
        $this->controller = $con;
        if (!is_null($filename)) {
            // @refactor @todo ; think we can remove this getListing call
            $this->getListing();
            $this->entry = $this->getGenericEntryFromListingHead();
        }
        if (!is_object($this->entry)) {
            $this->entry = new GenericEntry();
        }
        $this->entry->setRawname($this->controller->getRawname());
        $this->setArgs($this->controller->getArgs());
        // assume we're dealing simple Metadata for now (e.g. not Video)
        $this->metadata = new ImageMetadata($this, $this->entry);
    }

    /**
     * Get the contents of a file, then load available metadata
     * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::get()
     */
    public function get()
    {
        $imgdata = parent::get();
        if ($imgdata) {
            $this->readImageMetadata($imgdata);
        }
        return $imgdata;
    }

    /**
     * @return array settings
     */
    public function getSettings()
    {
        return $this->controller->getSettings();
    }

    /**
     * @return object directory [generic] entry
     */
    public function getGenericEntry()
    {
        return $this->entry;
    }

    public function dumbreadImageMetadata($imgdata)
    {
        // read metadata
        $info = array();
        $md = new ImageMetadata($this);
        // test (fast) if imgdata length > 0
        if (isset($imgdata[1])) {
            // can't use getimagesizefromstring as php > 5.4.0, so redirect via file wrapper
            $uri = 'data://application/octet-stream;base64,' . base64_encode($imgdata);
            $mdata = getimagesize($uri, $info);
            $md = $md->read($mdata, $info);
        } else {
            // debug_print_backtrace();
            $this->controller->error('problem reading ' . $this->file_part . ', length ' . strlen($imgdata) . ' bytes' . "<br />\r\n", true);
        }
        return $md;
    }

    /**
     * Pull metadata from this image data block and store in directory [generic] entry
     * @param string $imgdata Image file as a string
     * @return object processed metadata object
     */
    public function readImageMetadata($imgdata)
    {
        // store metadata block in entry for controller
        $this->metadata = $this->dumbreadImageMetadata($imgdata);
        $this->entry->setMetadata($this->metadata);
        // return object
        return $this->metadata;
    }

    /**
     * @return object return metadata object
     */
    public function getMetadata()
    {
        return $this->metadata;
    }

    /**
     * @param object $md metadata object
     */
    public function setMetadata($md)
    {
        $this->metadata = $md;
    }

    /**
     * Overriden getListing function that adds metadata to the elements
     * @see \Lightenna\StructuredBundle\DependencyInjection\FileReader::getListing()
     */
    public function getListing()
    {
        $listing = parent::getListing();
        // loop through each obj (object refs have implicit &$obj)
        foreach ($listing as $entry) {
            $this->parseObject($entry);
        }
        if ($this->isDirectory()) {
            // if we're processing a directory, loop through files and pull their metadata
            foreach ($listing as $entry) {
                $this->parseDirectoryEntry($entry);
            }
        }
        // add in shares within this folder
        $settings = $this->controller->getSettings();
        if (!is_null($this->name) && isset($settings['attach'][ltrim($this->name, Constantly::DIR_SEPARATOR_URL)])) {
            $shares = $settings['attach'][ltrim($this->name, Constantly::DIR_SEPARATOR_URL)];
            foreach ($shares as $k => &$sh) {
                $entry = new GenericEntry();
                $entry->setName($sh['name']);
                $entry->setAlias(isset($sh['alias']) ? $sh['alias'] : $sh['name']);
                $entry->setType('directory');
                $entry->setPath($sh['path']);
                $entry->setFile($sh['path']);
                $entry->setFileOriginal($sh['path']);
                $listing[] = $entry;
            }
        }
        if ($this->isDirectory()) {
            // sort directory based on entry type
            usort($listing, function ($a, $b) {
                $typeorder = array('image', 'directory', 'genfile');
                $refa = array_search($a->getType(), $typeorder);
                $refb = array_search($b->getType(), $typeorder);
                if ($refa == $refb) {
                    return ($a->getName() < $b->getName()) ? -1 : 1;
                }
                return ($refa < $refb) ? -1 : 1;
            });
            // finally add sequence number to each directory entry
            $seq = 0;
            foreach ($listing as $entry) {
                // add sequence number (zero-based; dense, not sparse; includes non-images)
                $entry->setSeq($seq++);
            }
        }
        return $listing;
    }

    /**
     * skim function
     * @return array $listing without named fields
     */
    public function skimListing($listing)
    {
        // dump protected or irrelevant fields
        array_walk($listing, function (&$item, $key) {
            // $dumpList = ['mfr', 'path','file','file_original'];
            // foreach($dumpList as &$dump) {
            //   unset($item->{$dump});
            // }
        });
        return $listing;
    }

    /**
     * Add metadata fields to directory entries
     * @param Object $entry Listing object
     */
    public function parseDirectoryEntry($entry)
    {
        switch ($entry->getType()) {
            case 'image':
                // get the image metadata by reading (cached-only) file
                // fast enough (110ms for 91 images)
                $returned_entry = $this->getDirectoryEntryMetadata($entry);
                break;
            case 'video':
                // get the video metadata by reading (cached-only) file
                $returned_entry = $this->getDirectoryEntryMetadata($entry);
                break;
            default:
                break;
        }
        return $entry;
    }

    /**
     * Work out the orientation of the current or a named image
     * @param object $entry GenericEntry
     * @param boolean $forceGet true to always load image
     * @return object $obj only used for testing, or null on failure
     */
    public function getDirectoryEntryMetadata($entry = null, $forceGet = false)
    {
        if (is_null($entry)) {
            $imgdata = $this->get();
            $entry = new GenericEntry();
            $entry_meta = $entry->getMetadata();
        } else {
            // check to see if we've already got metadata for this entry
            if ($entry->getMetadata()->hasRatio()) {
                return $entry;
            }
            $entry_mfr = $this->getDirectoryEntryMetadataFileReader($entry);
            // pull out image data
            $imgdata = ($forceGet ? $entry_mfr->get() : $entry_mfr->getOnlyIfCached());
            // pull out mfr's metadata
            $entry_meta = $entry_mfr->getMetadata();
            $entry->setMetadata($entry_meta);
            // @todo this print_r exposes that we're calling it twice
            // transfer metadata from cached copy to this directory entry
            if ($entry_mfr->getGenericEntry()->hasCacheKey()) {
                $entry->setCachekey($entry_mfr->getGenericEntry()->getCacheKey());
            }
        }
        // try and use metadata first
        if ($entry_meta->hasRatio()) {
            return null;
        }
        // if we don't have the metadata, try and pull from image
        if ($imgdata == null)
            return null;
        if (!self::checkImageDatastream($imgdata))
            return null;
        // create an image, then read out the width and height
        $img = @imagecreatefromstring($imgdata);
        if ($img) {
            $entry_meta->setLoadedWidth(imagesx($img));
            $entry_meta->setLoadedHeight(imagesy($img));
            $entry_meta->calcRatio();
        }
        return $entry;
    }

    /**
     * setup a [Cached]MetadataFileReader for this directory [generic] entry
     * @param $entry directory [generic] entry
     * @return MetadataFileReader $mfr for $obj
     */
    protected function getDirectoryEntryMetadataFileReader($entry)
    {
        // try and use the entry's FileReader
        $mfr = $entry->getMetadataFileReader();
        if ($mfr === null) {
            $filename = $this->getFullname($entry);
            // local reader needs to use this reader's args (to get correctly size-cached thumbnails)
            // @todo this should really be either a MetadataFileReader or a CachedMetadataFileReader
            $mfr = new CachedMetadataFileReader($filename, $this->controller);
            // tweak rawname using path from controller but leaf from obj
            $entry_name = $this->controller->getRawname() . Constantly::DIR_SEPARATOR_URL . $entry->getName();
            $mfr->getGenericEntry()->setRawname($entry_name);
            // setup local reader
            $mfr->setArgs($this->args);
            // store this read back into the entry for future use
            $entry->setMetadataFileReader($mfr);
        }
        return $mfr;
    }

    /**
     * Can't remember what this does
     * @param string $n URL name
     */
    public function injectShares($n)
    {
        $this->name = $n;
    }

    /**
     * Add metadata fields to object
     * @param Object $entry Listing object
     */

    public function parseObject($entry)
    {
        $name = $entry->getName();
        $entry->setExt(self::getExtension($name));
        // catch hidden files
        if ($name[0] == '.') {
            $entry->setHidden(true);
        }
        // if the listing said it was a generic file
        if ($entry->getType() == 'genfile') {
            // try and match specific-type based on extension
            $extmatch = strtolower($entry->getExt());
            if (in_array($extmatch, explode(',', Constantly::FILETYPES_IMAGE))) {
                $entry->setType('image');
            } else if (in_array($extmatch, explode(',', Constantly::FILETYPES_VIDEO))) {
                $entry->setType('video');
            } else if (in_array($extmatch, explode(',', Constantly::FILETYPES_ZIP))) {
                $entry->setType('directory');
            }
        } else {
            // others already typed as directory
        }
        return $entry;
    }

    /**
     * Set the arguments for this file reader
     * @param object $args
     */
    public function setArgs($args)
    {
        $this->args = $args;
    }

    /**
     * Add arguments to our argument array
     * Arguments influence the cachestring in the CachedMetadataFileReader
     * @param object $args
     */
    public function mergeArgs($args)
    {
        if ($this->args === null) {
            $this->args = $args;
        } else {
            $this->args->mergeArgs($args);
        }
    }

    /**
     * Rewrite the current file's path
     * @todo may need to tweak for things in zips
     */
    public function rewrite($newname)
    {
        parent::rewrite($newname);
        $this->entry->setFile($newname);
        // don't rewrite its extension because we don't use that for file access, only for type detection
        // $this->entry->ext = self::getExtension($this->entry->file);
        return $newname;
    }

    /**
     * Create a string to uniquely identify these image arguments
     * @param object $args URL arguments
     * @return string arguments as a string
     */
    static function flattenKeyArgs($args)
    {
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
