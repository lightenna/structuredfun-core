<?php

namespace Lightenna\StructuredBundle\Entity;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\ORM\Mapping\InheritanceType;
use Doctrine\ORM\Mapping\DiscriminatorColumn;
use Doctrine\ORM\Mapping\DiscriminatorMap;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\IptcWriter;
use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;

/**
 * ImageMetadata model
 * @ORM\Entity
 * @ORM\Table(name="image")
 * @InheritanceType("JOINED")
 * @DiscriminatorColumn(name="media_type", type="string")
 * @DiscriminatorMap({"image" = "ImageMetadata", "video" = "VideoMetadata"})
 * @IgnoreAnnotation("fn")
 */
class ImageMetadata {
  /**
   * Definitions and notes
   *   scope: only fields defined here get unserialised back from files
   *   loaded: the actual locally-cached image file that this data is about
   *   original: the remote originator, from which this image was derived
   */

  //
  // Fields
  //

  /**
   * @ORM\Column(type="integer")
   * @ORM\Id
   * @ORM\GeneratedValue(strategy="AUTO")
   */
  protected $id = null;

  /**
   * version number used to verify ours/not-ours
   * @ORM\Column(type="string", length=100)
   */
  protected $sfun_version = '0.9.3';

  /**
   * location of the remote originator
   * @ORM\Column(type="text")
   */
  protected $original_source = null;

  /**
   * width of original file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $original_width = null;

  /**
   * height of original file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $original_height = null;

  /**
   * location of this loaded file
   * @ORM\Column(type="text")
   */
  protected $loaded_source = null;

  /**
   * width of loaded file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $loaded_width = null;

  /**
   * height of loaded file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $loaded_height = null;

  /**
   * image mode (rgb or cmyk)
   * @ORM\Column(type="string", length=8)
   */
  protected $mode = 'rbg';

  /**
   * number of bits to store each colour channel
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $bits_per_pixel = null;

  /**
   * mime type
   * @ORM\Column(type="string", length=16)
   */
  protected $mime = null;

  /**
   * ratio of width:height, orientation (x || y)
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $ratio = null;

  /**
   * image dimension orientation (portrait, x, default)
   * @ORM\Column(type="string", length=1)
   */
  protected $orientation = 'x';

  /**
   * @ORM\Column(type="text")
   */
  protected $iptc_headline = null;

  /**
   * @ORM\Column(type="text")
   */
  protected $iptc_caption = null;

  /**
   * @ORM\Column(type="text")
   */
  protected $iptc_byline = null;

  /**
   * @ORM\Column(type="text")
   */
  protected $iptc_keywords = null;

  /**
   * @ORM\Column(type="text")
   */
  protected $iptc_copyright = null;

  /**
   * @ORM\Column(type="text")
   */
  protected $iptc_source = null;

  /**
   * metadata is not editable without settings connection
   * @ORM\Column(type="boolean")
   */
  protected $editable = null;

  //
  // Fields Derived
  // (not stored in database)
  //

  /**
   * image width normalised within bucket of key
   * e.g. [1] => 1, [2] => 0.6, [3] => 0.32
   */
  protected $normal_width = array();

  /**
   * image height normalised within bucket of key
   */
  protected $normal_height = array();


  //
  // Methods
  //

  /**
   * @param object $mfr Metadata File Reader (parent)
   * @param object $in stats, directory entry
   */
  public function __construct($mfr = null, $entry = null) {
    // cannot store parent here without serialising it to all files
    // $this->parent = $mfr;
    if ($entry !== null) {
      $this->ingestStats($entry);
    }
    if ($mfr !== null) {
      // metadata editability is dependent on settings
      $settings = $mfr->getSettings();
      $this->editable = ($settings['general']['metadata_editable'] == true);
    }
  }

  /**
   * Defaults must take the same form (_ not camel) as the class attributes
   * @return array default values
   */
  static function getDefaults($underscore = false) {
    return array(
      ($underscore ? 'iptc_headline' : 'iptcHeadline') => 'Untitled',
      ($underscore ? 'iptc_caption' : 'iptcCaption') => 'Caption pending',
      ($underscore ? 'iptc_byline' : 'iptcByline') => 'Author pending',
      ($underscore ? 'iptc_keywords' : 'iptcKeywords') => 'structured;fun',
      ($underscore ? 'iptc_copyright' : 'iptcCopyright') => 'Copyright remains with author, image transformation licence granted to StructuredFun',
      ($underscore ? 'iptc_source' : 'iptcSource') => 'Source pending',
    );
  }

  /**
   * Select and rename a few of the stats fields for storing as image metadata
   * @param object $obj
   * @return object filtered and renamed metadata (this object)
   */
  public function ingestStats($obj) {
    // setup defaults (hopefully overwrite later)
    $values = self::getDefaults(true);
    // pull source filename
    if (isset($obj->{'file_original'})) {
      $this->original_source = 'file://'.$obj->file_original;
    }
    // use alias to set headline (if unset, hence imbue)
    if (isset($obj->{'alias'})) {
      $values['iptc_headline'] = str_replace('_', ' ', FileReader::stripExtension($obj->alias));
    }
    $this->imbue($values);
    return $this;
  }

  /**
   * Process raw output from getimagesize()
   * see http://php.net/manual/en/function.getimagesize.php
   * @param array $mdata basic metadata about the image
   * @param array $info IPTC metadata array in APP13
   */
  public function read($mdata, $info) {
    // start off by assuming we're updating this instance of ImageMetadata
    $meta = $this;
    // if metadata has IPTC fields
    if (isset($info['APP13'])) {
      $iptc = new IptcWriter();
      $iptc->prime(iptcparse($info['APP13']));
      // pull entire meta block if set, silence warning incase not
      $iptc_special = $iptc->get(IPTC_SPECIAL_INSTRUCTIONS);
      $candidate_meta = @unserialize($iptc_special);
      if (isset($candidate_meta->{'sfun_version'})) {
        // sfun image so use serialized object version of metadata
        $meta = $candidate_meta;
      } else {
        // unable to read metadata object whole, so read field-by-field
        $candidate = array(
          'iptc_headline' => $iptc->get(IPTC_HEADLINE),
          'iptc_caption' => $iptc->get(IPTC_CAPTION),
          'iptc_byline' => $iptc->get(IPTC_BYLINE),
          'iptc_keywords' => $iptc->get(IPTC_KEYWORDS),
          'iptc_copyright' => $iptc->get(IPTC_COPYRIGHT_STRING),
          'iptc_source' => $iptc->get(IPTC_SOURCE),
        );
        // if we retreived any of the above fields, use them to overwrite defaults
        $this->imbue($candidate, true);        
      }
    }
    // if we have basic metadata
    if (is_array($mdata)) {
      // use it to overwrite none/deserialized/candidate metadata
      if (isset($mdata[1])) {
        $meta->setLoadedWidth($mdata[0]);
        $meta->setLoadedHeight($mdata[1]);
        if (!$meta->hasOriginalWidth()) {
          $meta->setOriginalWidth($mdata[0]);
          $meta->setOriginalHeight($mdata[1]);
        }
      }
      if (isset($mdata['mime'])) {
        $meta->setMime($mdata['mime']);
      }
      if (isset($mdata['bits'])) {
        $meta->setBitsPerPixel($mdata['bits']);
      }
      if (isset($mdata['channels']) && $mdata['channels'] == 4) {
        $meta->setMode('cmyk');
      }
    }
    return $meta;
  }

  /**
   * should really be ingest, but I like the word imbue
   * @param  array $candidate array of values to set as fields
   * @param  boolean $force true to always imbue the value if it's set
   */
  public function imbue($candidate, $force = false) {
    foreach($candidate as $k => $v) {
      // only set values if unset or forced
      if ($v && (is_null($this->{$k}) || $force)) {
        $this->{$k} = $v;
      }
    }
  }

  /**
   * Write metadata to file in cache
   * @todo make sure this isn't a double write (file_put_contents then IptcWriter)
   */
  public function write($filename) {
    $iptc = new IptcWriter($filename);
    // can use set without get, because we're creating the file from scratch
    $iptc->set(IPTC_SPECIAL_INSTRUCTIONS, $this->serialize());
    // IPTC Caption: Windows 'Subject'
    $iptc->set(IPTC_HEADLINE, $this->iptc_headline);
    // IPTC Caption: Windows 'Title'
    $iptc->set(IPTC_CAPTION, $this->iptc_caption);
    // IPTC Byline: Windows 'Authors'
    $iptc->set(IPTC_BYLINE, $this->iptc_byline);
    // IPTC Keywords: Windows 'Tags'
    $iptc->set(IPTC_KEYWORDS, $this->iptc_keywords);
    // IPTC Copyright string: Windows 'Copyright', visibile in 'Details'
    $iptc->set(IPTC_COPYRIGHT_STRING, $this->iptc_copyright);
    // IPTC Source
    $iptc->set(IPTC_SOURCE, $this->iptc_source);
    // write the file
    $iptc->save();
  }
  
  /**
   * @return string this metadata object serialised
   */
  public function serialize() {
    return serialize($this);
  }

  /**
   * @return object public-field object for inclusion in JSON output
   */
  public function retrieveJSONObject() {
    $obj = new \stdClass();
    foreach($this as $key => $value) {
      $obj->{$key} = $value;
    }
    return $obj;
  }

  /**
   * @return object form for updating this metadata object
   */
  public function getForm($controller) {
    $form = $controller->createFormBuilder($this)
      ->add('iptcHeadline', 'text', array('required' => false, 'attr' => array('class' => 'iptcHeadline')))
      ->add('iptcByline', 'text', array('required' => false))
      ->add('iptcCaption', 'text', array('required' => false))
      ->add('iptcKeywords', 'text', array('required' => false))
      ->add('iptcCopyright', 'text', array('required' => false))
      ->add('iptcSource', 'text', array('required' => false))
      ->add('save', 'submit', array('label' => 'Update Metadata'))
      ->getForm();
    return $form;
  }

  /**
   * @param object raw form data
   */
  public function processFormData($data) {
    // happens automatically so this isn't called
  }

  /**
   * update this record in the database
   */
  public function updateDB() {

  }

  /**
   * write metadata back to original image
   */
  public function updateOriginal() {
    // @todo Bug#1101: shouldn't just serialise this object
    // because some things change for the original
    //   loaded_width
    //   loaded_height
    $this->write($this->getOriginalSourceFilename());
  }

  //
  // ACCESSOR & MUTATOR methods
  // used by form api and JSON serializer
  //

  public function getIptcHeadline() {
    return $this->iptc_headline;
  }
  public function setIptcHeadline($value) {
    $this->iptc_headline = $value;
  }

  public function getIptcCopyright() {
    return $this->iptc_copyright;
  }
  public function setIptcCopyright($value) {
    $this->iptc_copyright = $value;
  }

  public function getIptcSource() {
    return $this->iptc_source;
  }
  public function setIptcSource($value) {
    $this->iptc_source = $value;
  }

  public function getIptcCaption() {
    return $this->iptc_caption;
  }
  public function setIptcCaption($value) {
    $this->iptc_caption = $value;
  }

  public function getIptcKeywords() {
    return $this->iptc_keywords;
  }
  public function setIptcKeywords($value) {
    $this->iptc_keywords = $value;
  }

  public function getIptcByline() {
    return $this->iptc_byline;
  }
  public function setIptcByline($value) {
    $this->iptc_byline = $value;
  }

  public function getRatio() {
    return $this->ratio;
  }

  public function hasRatio() {
    return ($this->ratio !== null);
  }

  /**
   * recalculate image aspect ratio
   */
  public function calcRatio() {
    // round to 5DP (0.1px for a 10k image)
    $this->ratio = round($this->loaded_width / $this->loaded_height, 5);
    // orientation
    $this->orientation = 'x';
    if ($this->loaded_width < $this->loaded_height) {
      $this->orientation = 'y';
    }
  }

  public function getNormalWidth($breadth) {
    return $normal_width[$breadth];
  }

  public function setNormalWidth($breadth, $n) {
    $normal_width[$breadth] = $n;
  }

  public function getNormalHeight($breadth) {
    return $normal_height[$breadth];
  }

  public function setNormalHeight($breadth, $n) {
    $normal_height[$breadth] = $n;
  }

  public function getMime() {
    return $this->mime;
  }

  public function setMime($m) {
    $this->mime = $m;
  }

  public function getBitsPerPixel() {
    return $this->bits_per_pixel;
  }

  public function setBitsPerPixel($bpp) {
    $this->bits_per_pixel = $bpp;
  }

  public function getMode() {
    return $this->mode;
  }

  public function setMode($m) {
    $this->mode = $m;
  }

  public function getOrientation() {
    return $this->orientation;
  }
  public function setOrientation($o) {
    // only used extremely rarely (for things that can't recalculate ratio)
    $this->orientation = $o;
  }

  public function getEditable() {
    return $this->editable;
  }

  public function getLoadedWidth() {
    return $this->loaded_width;
  }

  public function setLoadedWidth($w) {
    $this->loaded_width = $w;
  }

  public function getLoadedHeight() {
    return $this->loaded_height;
  }

  public function setLoadedHeight($h) {
    $this->loaded_height = $h;
  }

  public function getOriginalSource() {
    return $this->original_source;
  }
  public function getOriginalSourceFilename() {
    $s = $this->getOriginalSource();
    $filepro = 'file://';
    $len = strlen($filepro);
    if (!strncmp($s, $filepro, $len)) {
      $s = substr($s, $len);
    }
    return $s;
  }

  public function hasOriginalWidth() {
    return ($this->original_width !== null);
  }
  public function getOriginalWidth() {
    return $this->original_width;
  }
  public function setOriginalWidth($ow) {
    $this->original_width = $ow;
  }
  public function getOriginalHeight() {
    return $this->original_height;
  }
  public function setOriginalHeight($oh) {
    $this->original_height = $oh;
  }

  //
  // STATIC methods
  //

  /**
   * @return array list of fields (with getters/setters) that shouldn't be serialized
   */
  static function getIgnoredAttributes() {
    return array('defaults', 'originalSource', 'originalSourceFilename', 'ignoredAttributes');
  }

}
