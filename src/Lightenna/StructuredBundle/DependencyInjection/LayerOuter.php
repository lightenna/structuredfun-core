<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\Entity\ImageMetadata;

class LayerOuter {

  protected $listing = null;

  public function __construct($l) {
    $this->listing = $l;
  }

  public function layout($breadth, $direction) {
    $this->checkListing($this->listing);
    $buckets = $this->bucketListing($this->listing, $breadth);
    if ($buckets === false) {
      // can't layout buckets (uncached images)
      return;
    }
    // buckets start at 0 on the major axis
    $running_major = 0;
    foreach ($buckets as &$bucket) {
      $this->calcMinorAxesSizes($bucket, 1.0, $direction);
      // increment position on major axis for this bucket
      $running_major += $this->calcMajorAxesSizes($bucket, $direction);
      // store running major in all cells in bucket, calc running minor within each bucket
      $this->storePositionN($bucket, $direction, $running_major);
    }
    // do b=1: entries start at 0 on the major axis
    $running_major = 0;
    foreach ($this->listing as &$entry) {
      $running_major += $this->storePosition1($entry, $direction, $running_major);
    }
  }

  /**
   * check all the entries
   */
  private function checkListing(&$listing) {
    // maybe don't need this
  }

  /**
   * break a listing up into buckets
   * @param  array &$listing
   * @param  int $bucket_size
   * @return array of arrays or false on failure, i.e. array of buckets
   */
  public function bucketListing(&$listing, $bucket_size) {
    $listing_length = count($listing);
    $buckets = array();
    $current_bucket = null;
    // loop through listing creating buckets
    for ($i = 0 ; $i < $listing_length ; ++$i) {
      $bucketRef = ($i % $bucket_size);
      // if this loop iteration is on a bucket boundary
      if ($bucketRef == 0) {
        // if we've got a bucket
        if ($current_bucket != null) {
          // add last bucket to buckets array without copying it
          $buckets[] = $current_bucket;
        }
        // create a new bucket
        $current_bucket = array();
      }
      // always add entry to current bucket
      $current_bucket[] = $listing[$i];
    }
    return $buckets;
  }

  /**
   * calculate minor axes sizes, which sum to total
   * @param array $bucket array of cells as GenericEntrys
   * @param float $total that this minor should sum to
   */
  private function calcMinorAxesSizes(&$bucket, $total, $direction) {
    $bucket_length = count($bucket);
    $minor_total = 0;
    // sum minor axes to get total
    for ($i = 0 ; $i < $bucket_length ; ++$i) {
      $image_metadata = $bucket[$i]->getMetadata();
      $ratio = $image_metadata->getRatio();
      // calculate the minor-axis size based on image ratio alone
      $minor_by_ratio = ($direction == 'x' ? 1 / $ratio : 1 * $ratio);
      // sum to total
      $minor_total += $minor_by_ratio;
      // also set major and minor (b=1) while we've got the references handy
      if ($direction == 'x') {
        $image_metadata->setNormalWidth(1, $direction, 1 * $ratio);
        $image_metadata->setNormalHeight(1, $direction, 1);
      } else {
        $image_metadata->setNormalHeight(1, $direction, 1 / $ratio);
        $image_metadata->setNormalWidth(1, $direction, 1);
      }
    }
    // normalise by dividing by total
    $ratio_factor = $total / $minor_total;
    // store normalised minors back
    for ($i = 0 ; $i < $bucket_length ; ++$i) {
      $image_metadata = $bucket[$i]->getMetadata();
      $ratio = $image_metadata->getRatio();
      // calculate the minor-axis size based on image ratio alone
      $minor_by_ratio = ($direction == 'x' ? 1 / $ratio : 1 * $ratio);
      // if the major axis is x, minors are heights
      if ($direction == 'x') {
        $image_metadata->setNormalHeight($bucket_length, $direction, $minor_by_ratio * $ratio_factor);
      } else {
        $image_metadata->setNormalWidth($bucket_length, $direction, $minor_by_ratio * $ratio_factor);
      }
    }
  }

  /**
   * calculate major axes sizes
   * @param array $bucket array of cells as GenericEntrys
   */
  private function calcMajorAxesSizes(&$bucket, $direction) {
    $bucket_length = count($bucket);
    $minor_size = 1.0;
    // derive sizes on major axis from minors
    for ($i = 0 ; $i < $bucket_length ; ++$i) {
      $image_metadata = $bucket[$i]->getMetadata();
      $ratio = $image_metadata->getRatio();
      // load minor from last cycle (calcMinorAxesSizes)
      $minor = ($direction == 'x' ? $image_metadata->getNormalHeight($bucket_length, $direction) : $image_metadata->getNormalWidth($bucket_length, $direction));
      // calculate the major axis size based on each minor and the image ratio
      if ($direction == 'x') {
        $major = $minor * $ratio;
        $image_metadata->setNormalWidth($bucket_length, $direction, $major);
      } else {
        $major = $minor / $ratio;
        $image_metadata->setNormalHeight($bucket_length, $direction, $major);
      }
    }
    // return last major, because they should all be the same
    return $major;
  }

  private function storePositionN(&$bucket, $direction, $running_major) {
    $bucket_length = count($bucket);
    // cells always start at 0 on the minor axis for each bucket
    $running_minor = 0;
    // derive positions using running major and minor
    for ($i = 0 ; $i < $bucket_length ; ++$i) {
      $image_metadata = $bucket[$i]->getMetadata();
      if ($direction == 'x') {
        $image_metadata->setNormalX($bucket_length, $direction, $running_major);
        $image_metadata->setNormalY($bucket_length, $direction, $running_minor);
      } else {
        $image_metadata->setNormalY($bucket_length, $direction, $running_major);        
        $image_metadata->setNormalX($bucket_length, $direction, $running_minor);
      }
      // pull minor size
      $minor = ($direction == 'x' ? $image_metadata->getNormalHeight($bucket_length, $direction) : $image_metadata->getNormalWidth($bucket_length, $direction));
      // increment minor position by minor size of this last cell
      $running_minor += $minor;
    }
  }

  private function storePosition1(&$entry, $direction, $running_major) {
    $image_metadata = $entry->getMetadata();
    $ratio = $image_metadata->getRatio();
    if ($direction == 'x') {
      $major = 1 * $ratio;
      $image_metadata->setNormalX(1, $direction, $running_major);
      $image_metadata->setNormalY(1, $direction, 0);
    } else {
      $major = 1 / $ratio;
      $image_metadata->setNormalY(1, $direction, $running_major);        
      $image_metadata->setNormalX(1, $direction, 0);
    }
    return $major;
  }


}
