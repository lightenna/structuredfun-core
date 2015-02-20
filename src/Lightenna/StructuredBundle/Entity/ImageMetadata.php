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
  protected $id;

  /**
   * version number used to verify ours/not-ours
   * @ORM\Column(type="string", length=100)
   */
  protected $sfun_version = '0.9.2';

  /**
   * location of the remote originator
   * @ORM\Column(type="text")
   */
  protected $original_source;

  /**
   * width of original file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $original_width;

  /**
   * height of original file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $original_height;

  /**
   * location of this loaded file
   * @ORM\Column(type="text")
   */
  protected $loaded_source;

  /**
   * width of loaded file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $loaded_width;

  /**
   * height of loaded file
   * @ORM\Column(type="decimal", scale=2)
   */
  protected $loaded_height;

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
  // Methods
  //

  /**
   * @param object $mfr Metadata File Reader (parent)
   * @param object $in stats
   */
  public function __construct($mfr = null, $in = null) {
    // cannot store parent here without serialising it to all files
    // $this->parent = $mfr;
    if ($in !== null) {
      $this->filterStats($in);
    }
    if ($mfr !== null) {
      // metadata editability is dependent on settings
      $settings = $mfr->getSettings();
      $this->editable = ($settings['general']['metadata_editable'] == true);
    }
  }

  /**
   * @return array default values
   */
  static function getDefaults() {
    return array(
      'iptc_headline' => 'Untitled',
      'iptc_caption' => 'Caption pending',
      'iptc_byline' => 'Author pending',
      'iptc_keywords' => 'structured;fun',
      'iptc_copyright' => 'Copyright remains with author, image transformation licence granted to StructuredFun',
      'iptc_source' => 'Source pending',
    );
  }

  /**
   * Select and rename a few of the stats fields for storing as image metadata
   * @param object $in
   * @return object filtered and renamed metadata (this object)
   */
  public function filterStats($in) {
    // setup defaults (hopefully overwrite later)
    $values = self::getDefaults();
    // pull source filename
    if (isset($in->{'file_original'})) {
      $this->original_source = 'file://'.$in->file_original;
    }
    // use alias to set headline (if unset, hence imbue)
    if (isset($in->{'alias'})) {
      $values['iptc_headline'] = str_replace('_', ' ', FileReader::stripExtension($in->alias));
    }
    $this->imbue($values);
    // always update resolution/resolution_loaded
    if (isset($in->{'width'})) {
      $this->original_width = $in->width;
      $this->original_height = $in->height;
    }
    if (isset($in->{'newwidth'})) {
      $this->loaded_width = $in->newwidth;
      $this->loaded_height = $in->newheight;
      $this->calcRatio();
    }
    return $this;
  }

  /**
   * Process raw output from getimagesize()
   * @param array $info
   */
  public function read($info) {
    // if metadata has IPTC fields
    if (isset($info['APP13'])) {
      $iptc = new IptcWriter();
      $iptc->prime(iptcparse($info['APP13']));
      // pull entire meta block if set, silence warning incase not
      $iptc_special = $iptc->get(IPTC_SPECIAL_INSTRUCTIONS);
      $meta = @unserialize($iptc_special);
      if (isset($meta->{'sfun_version'})) {
        // sfun image so use serialized object version of metadata
        return $meta;
      }
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
    return $this;
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
      ->add('iptc_headline', 'text', array('required' => false, 'attr' => array('class' => 'iptc_headline')))
      ->add('iptc_byline', 'text', array('required' => false))
      ->add('iptc_caption', 'text', array('required' => false))
      ->add('iptc_keywords', 'text', array('required' => false))
      ->add('iptc_copyright', 'text', array('required' => false))
      ->add('iptc_source', 'text', array('required' => false))
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
  public function getOriginalWidth() {
    return $this->original_width;
  }
  public function getOriginalHeight() {
    return $this->original_height;
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
