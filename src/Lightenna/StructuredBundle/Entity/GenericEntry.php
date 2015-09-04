<?php

namespace Lightenna\StructuredBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\ORM\Mapping\InheritanceType;
use Doctrine\ORM\Mapping\DiscriminatorColumn;
use Doctrine\ORM\Mapping\DiscriminatorMap;

use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\IptcWriter;
use Lightenna\StructuredBundle\Entity\ImageMetadata;

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
    protected $path = null;
    protected $file = null;
    protected $file_original = null;
    protected $zip_path = null;
    protected $seq = null;
    protected $cachekey = null;
    protected $subfolderCount = 0;

    // objects
    protected $meta = null;
    protected $mfr = null;

    // to sort out in future (temporary fields for now)
    public $newwidth;
    public $newheight;

    //
    // Methods
    //

    /**
     * Create GenericEntry instance
     */
    public function __construct()
    {
        $this->meta = new ImageMetadata(null, null);
    }

    //
    // ISSER methods
    //

    public function isZip()
    {
        return ($this->zip_path !== null);
    }

    public function isImage()
    {
        return ($this->type == 'image');
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

    public function getZipPath()
    {
        return $this->zip_path;
    }

    public function setZipPath($z)
    {
        $this->zip_path = $z;
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

    public function getMetadata()
    {
        return $this->meta;
    }

    public function setMetadata($m)
    {
        return $this->meta = $m;
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
        return array('fileOriginal', 'file', 'path', 'metadataFileReader', 'ignoredAttributes');
    }

    public function serialise()
    {
        $encoders = array(new XmlEncoder(), new JsonEncoder());
        $normalizers = array(new GetSetMethodNormalizer());
        $igFields = array_merge(self::getIgnoredAttributes(), ImageMetadata::getIgnoredAttributes());
        $normalizers[0]->setIgnoredAttributes($igFields);
        $serializer = new Serializer($normalizers, $encoders);
        $jsonContent = $serializer->serialize($this, 'json');
        return $jsonContent;
    }

}
