<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;
class Metadata {
  // only fields defined here get unserialised back from files
  // version number used to verify ours/not-ours
  public $sfun_version = '0.9.1';

  // resolution of original file
  public $width, $height;
  // resolution as loaded in this instance (after transform)
  public $loaded_width, $loaded_height;
  // ratio of width:height, orientation (x || y)
  public $ratio, $orientation;
  // IPTC fields that we use/display
  public $headline = null, $caption = null, $byline = null;
  public $keywords = null, $copyright = null, $source = null;
  // metadata is not editable without settings connection
  public $editable = null;

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
   * recalculate image aspect ratio
   */
  public function recalcRatio() {
    // round to 5DP (0.1px for a 10k image)
    $this->ratio = round($this->loaded_width / $this->loaded_height, 5);
    // orientation
    $this->orientation = 'x';
    if ($this->loaded_width < $this->loaded_height) {
      $this->orientation = 'y';
    }
  }

  static function getDefaults() {
    return array(
      'headline' => 'Untitled',
      'caption' => 'Untitled',
      'byline' => 'Author unknown',
      'keywords' => 'structured;fun',
      'copyright' => 'Copyright unknown, image transformation licence granted to StructuredFun',
      'source' => 'Source unknown',
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
    // use alias to set headline (if unset, hence imbue)
    if (isset($in->{'alias'})) {
      $values['headline'] = str_replace('_', ' ', FileReader::stripExtension($in->alias));
    }
    $this->imbue($values);
    // always update resolution/resolution_loaded
    if (isset($in->{'width'})) {
      $this->width = $in->width;
      $this->height = $in->height;
    }
    if (isset($in->{'newwidth'})) {
      $this->loaded_width = $in->newwidth;
      $this->loaded_height = $in->newheight;
      $this->recalcRatio();
    }
    return $this;
  }

  /**
   * Process raw output from getimagesize()
   * @param array $info
   */
  function read($info) {
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
        'headline' => $iptc->get(IPTC_HEADLINE),
        'caption' => $iptc->get(IPTC_CAPTION),
        'byline' => $iptc->get(IPTC_BYLINE),
        'keywords' => $iptc->get(IPTC_KEYWORDS),
        'copyright' => $iptc->get(IPTC_COPYRIGHT_STRING),
        'source' => $iptc->get(IPTC_SOURCE),
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
    $iptc->set(IPTC_HEADLINE, $this->headline);
    // IPTC Caption: Windows 'Title'
    $iptc->set(IPTC_CAPTION, $this->caption);
    // IPTC Byline: Windows 'Authors'
    $iptc->set(IPTC_BYLINE, $this->byline);
    // IPTC Keywords: Windows 'Tags'
    $iptc->set(IPTC_KEYWORDS, $this->keywords);
    // IPTC Copyright string: Windows 'Copyright', visibile in 'Details'
    $iptc->set(IPTC_COPYRIGHT_STRING, $this->copyright);
    // IPTC Source
    $iptc->set(IPTC_SOURCE, $this->source);
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
   * @return object form for updating this metadata object
   */
  public function getForm($controller) {
    $form = $controller->createFormBuilder($this)
      ->add('headline', 'text', array('required' => false))
      ->add('byline', 'text', array('required' => false))
      ->add('caption', 'textarea', array('required' => false))
      ->add('keywords', 'text', array('required' => false))
      ->add('copyright', 'text', array('required' => false))
      ->add('source', 'text', array('required' => false))
      ->add('save', 'submit', array('label' => 'Update Metadata'))
      ->getForm();
    return $form;
  }

  /**
   * @param object raw form data
   */
  public function processFormData($data) {
  }

}
