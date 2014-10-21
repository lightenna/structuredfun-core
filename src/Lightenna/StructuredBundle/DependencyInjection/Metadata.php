<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;
class Metadata {
  // version number used to verify ours/not-ours
  public $sfun_version = '0.9.1';

  // resolution of original file
  public $width, $height;
  // resolution as loaded in this instance (after transform)
  public $width_loaded, $height_loaded;
  // ratio of width:height
  public $ratio;
  // IPTC fields that we use/display
  public $caption, $byline, $keywords, $copyright;

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
  }

  /**
   * recalculate image aspect ratio
   */
  public function recalcRatio() {
    // round to 5DP (0.1px for a 10k image)
    $this->ratio = round($this->width_loaded / $this->height_loaded, 5);    
  }

  static function getDefaults() {
    return array(
      'caption' => 'Untitled',
      'byline' => 'Author unknown',
      'keywords' => 'structured;fun',
      'copyright' => 'Copyright unknown, image transformation licence granted to StructuredFun',
    );
  }

  /**
   * Select and rename a few of the stats fields for storing as image metadata
   * @param object $in
   * @return object filtered and renamed metadata (this object)
   */
  public function filterStats($in) {
    // setup defaults (hopefully overwrite later)
    $this->imbue(self::getDefaults());
    // use alias to set caption
    if (isset($in->{'alias'})) {
      $this->caption = str_replace('_', ' ', FileReader::stripExtension($in->alias));
    }
    if (isset($in->{'width'})) {
      $this->width = $in->width;
      $this->height = $in->height;
    }
    if (isset($in->{'newwidth'})) {
      $this->width_loaded = $in->newwidth;
      $this->height_loaded = $in->newheight;
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
        'caption' => $iptc->get(IPTC_CAPTION),
        'byline' => $iptc->get(IPTC_BYLINE),
        'keywords' => $iptc->get(IPTC_KEYWORDS),
        'copyright' => $iptc->get(IPTC_COPYRIGHT_STRING),
      );
      // if we retreived any of the above fields, use them to overwrite defaults
      $this->imbue($candidate);
    }
    return $this;
  }

  /**
   * should really be ingest, but I like the word imbue
   * @param  array $candidate array of values to set as fields
   */
  public function imbue($candidate) {
    foreach($candidate as $k => $v) {
      if ($v) {
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
    // IPTC Caption: Windows 'Title'
    $iptc->set(IPTC_CAPTION, $this->caption);
    // IPTC Byline: Windows 'Authors'
    $iptc->set(IPTC_BYLINE, $this->byline);
    // IPTC Keywords: Windows 'Tags'
    $iptc->set(IPTC_KEYWORDS, $this->keywords);
    // IPTC Copyright string: Windows 'Copyright', visibile in 'Details'
    $iptc->set(IPTC_COPYRIGHT_STRING, $this->copyright);
    // write the file
    $iptc->save();
  }
  
  /**
   * @return string this metadata object serialised
   */
  public function serialize() {
    return serialize($this);
  }

}
