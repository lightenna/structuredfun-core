<?php

namespace Lightenna\StructuredBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\Encoder\XmlEncoder;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;

/**
 * GenericEntry model
 */
class GenericEntry
{

    //
    // Fields
    //

    protected $rawname = null;
    protected $name = null;
    protected $name_original_charset = null;
    protected $alias = null;
    protected $type = null;
    protected $hidden = null;
    protected $ext = null;

    // path to directory or zip (i.e. an entity that contains more entities)
    protected $path = null;

    // file and file_original are full filenames (including the path to this entity within zip)
    protected $file = null;
    protected $file_original = null;

    // zip_bit is the [redundant] path from the zip parent (x.zip/) to the file, including the file's final leaf (/123.jpg)
    protected $zip_bit = null;

    protected $seq = null;
    protected $cachekey = null;
    protected $subfolderCount = 0;

    // [Cached]MetadataFileReader, used to read this entry
    protected $mfr = null;

    // EntryLayout, used for storing information about how this entry is laid out
    protected $entlay = null;

    // Read-only copy of metadata, used for serialising (json for layout/imagemeta)
    protected $meta = null;

    //
    // Methods
    //

    /**
     * Create GenericEntry instance
     */
    public function __construct()
    {
        $this->meta = new ImageMetadata(null, null);
        $this->entlay = new EntryLayout();
    }

    //
    // ISSER methods
    //

    public function isZip()
    {
        return ($this->zip_bit !== null);
    }

    public function isImage()
    {
        return ($this->type == 'image');
    }

    public function isDirectory()
    {
        return ($this->type == 'directory');
    }

    //
    // GETTERs and SETTERs
    //

    // public function getUrlBase() {
    //   return $this->url_base;
    // }

    // public function setUrlBase($ub) {
    //   $this->url_base = $ub;
    // }

    // public function getUrlName() {
    //   return $this->url_base . $this->name;
    // }

    public function getName()
    {
        return $this->name;
    }

    public function setName($n)
    {
        $this->name = $n;
    }

    /**
     * @return $string name in its original filesystem charset
     */
    public function getNameOriginalCharset()
    {
        return $this->name_original_charset;
    }

    public function setNameOriginalCharset($n)
    {
        $this->name_original_charset = $n;
    }

    public function getAlias()
    {
        return $this->alias;
    }

    public function setAlias($a)
    {
        $this->alias = $a;
    }

    public function getType()
    {
        return $this->type;
    }

    public function setType($t)
    {
        $this->type = $t;
    }

    public function getHidden()
    {
        return $this->hidden;
    }

    public function setHidden($h)
    {
        $this->hidden = $h;
    }

    public function hasExt()
    {
        return ($this->ext !== null);
    }

    public function getExt()
    {
        return $this->ext;
    }

    public function setExt($e)
    {
        $this->ext = $e;
    }

    public function getPath()
    {
        return $this->path;
    }

    public function setPath($p)
    {
        $this->path = $p;
    }

    public function getFile()
    {
        return $this->file;
    }

    public function setFile($f)
    {
        $this->file = $f;
    }

    public function getFileOriginal()
    {
        return $this->file_original;
    }

    public function setFileOriginal($f)
    {
        $this->file_original = $f;
    }

    public function getZipBit()
    {
        return $this->zip_bit;
    }

    public function setZipBit($z)
    {
        $this->zip_bit = $z;
    }

    public function getSeq()
    {
        return $this->seq;
    }

    public function setSeq($s)
    {
        $this->seq = $s;
    }

    public function getRawname()
    {
        return $this->rawname;
    }

    public function getRawnameWithoutArgs()
    {
        return substr($this->rawname, 0, FileReader::stripArgsToFilename($this->rawname));
    }

    public function setRawname($rn)
    {
        $this->rawname = $rn;
    }

    public function hasCacheKey()
    {
        return ($this->cachekey !== null);
    }

    public function getCacheKey()
    {
        return $this->cachekey;
    }

    public function setCacheKey($k)
    {
        $this->cachekey = $k;
    }

    public function getSubfolderCount()
    {
        return $this->subfolderCount;
    }

    public function setSubfolderCount($c)
    {
        $this->subfolderCount = $c;
    }

    /**
     * always read metadata from master (in MetadataFileReader)
     * this function is crucial to layout and imagemeta serialisation
     * @return object stored metadata
     */
    public function getMetadata()
    {
        return $this->meta;
    }

    /**
     * metadata should be set but not gotten (always read from master in MetadataFileReader)
     * @param object $m metadata to store
     * @return object stored metadata
     */
    public function setMetadata($m)
    {
        return $this->meta = $m;
    }

    public function getEntryLayout() {
        return $this->entlay;
    }

    public function setEntryLayout($e) {
        $this->entlay = $e;
    }

    public function getMetadataFileReader()
    {
        return $this->mfr;
    }

    public function setMetadataFileReader($m)
    {
        $this->mfr = $m;
    }

    /**
     * @return array list of fields (with getters/setters) that shouldn't be serialized
     */
    static function getIgnoredAttributes()
    {
        // return array('fileOriginal', 'file', 'path', 'metadataFileReader', 'ignoredAttributes');
        return array('metadataFileReader', 'ignoredAttributes');
    }

    public function serialise()
    {
        $encoders = array(new XmlEncoder(), new JsonEncoder());
        $normalizers = array(new GetSetMethodNormalizer());
        $igFields = array_merge(ImageMetadata::getIgnoredAttributes(), GenericEntry::getIgnoredAttributes());
        $normalizers[0]->setIgnoredAttributes($igFields);
        $serializer = new Serializer($normalizers, $encoders);
        $jsonContent = $serializer->serialize($this, 'json');
        return $jsonContent;
    }

}
