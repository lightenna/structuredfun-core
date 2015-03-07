<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\Encoder\XmlEncoder;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

class LayoutviewController extends ViewController {

  public function indexAction($rawname, $format = 'html') {
    // store rawname being indexed
    $this->rawname = $rawname;
    // convert rawname to urlname and filename
    $filename = $this->convertRawToFilename($this->rawname);
    $name = self::convertRawToUrl($this->rawname);
    // create a file reader object to get directory/zip/directory-nested-in-zip listing
    $this->mfr = new CachedMetadataFileReader(null, $this);
    $this->mfr->rewrite($filename);
    $this->mfr->injectShares($name);
    $this->mfr->processDebugSettings();
    $thumbargs = new \stdClass();
    // don't need to include thumb=true in thumbargs because it's a non-key arg
    $thumbargs->{'maxlongest'} = 200;
    $this->mfr->injectArgs($thumbargs);
    if ($this->mfr->isExisting()) {
      if ($this->mfr->isDirectory()) {
        $dirmeta = $this->mfr->skimListing($this->mfr->getListing());
        $this->layoutListing($dirmeta, DEFAULT_LAYOUT_BREADTH);
        print($this->serialise($dirmeta));
        exit;
      }
    } else {
      // implied else
      return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
    }
  }

  /**
   * build a layout for a listing
   */
  public function layoutListing($listing, $breadth, $direction) {
    $buckets = $this->bucketListing($listing, $breadth);
    foreach ($buckets as &$bucket) {
      $this->calcMinorAxesSizes($bucket, 1.0, $direction);
    }
  }

  /**
   * break a listing up into buckets
   * @param  array &$listing
   * @param  int $bucket_size
   * @return array of arrays, i.e. array of buckets
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
      $imgMetadata = $bucket[$i]->getMeta();
      $ratio = $imgMetadata->getRatio();
// delete me
var_dump($ratio);
exit;
// problem: ratio is NULL
// because we're pulling this from test data, not cache
      // calculate the minor-axis size based on image ratio alone
      $minor_by_ratio = ($direction == 'x' ? 1 / $ratio : 1 * ratio);
      // sum to total
      $minor_total += $minor_by_ratio;
      // also set n=1 while we've got the references
      if ($direction == 'x') {
        $imgMetadata->setNormalHeight(1, $minor_by_ratio);
      } else {
        $imgMetadata->setNormalWidth(1, $minor_by_ratio);
      }
    }
    // normalise by dividing by total
    $ratio_factor = $minor_total / $total;
    // store normalised minors back
    for ($i = 0 ; $i < $bucket_length ; ++$i) {
      $imgMetadata = $bucket[$i]->getMeta();
      $ratio = $imgMetadata->getRatio();
      // calculate the minor-axis size based on image ratio alone
      $minor_by_ratio = ($direction == 'x' ? 1 / $ratio : 1 * ratio);
      // if the major axis is x, minors are heights
      if ($direction == 'x') {
        $imgMetadata->setNormalHeight($bucket_length, $minor_by_ratio * $ratio_factor);
      } else {
        $imgMetadata->setNormalWidth($bucket_length, $minor_by_ratio * $ratio_factor);
      }
    }
  }

  private function serialise($dirmeta) {
    $encoders = array(new XmlEncoder(), new JsonEncoder());
    $normalizers = array(new GetSetMethodNormalizer());
    $igFields = array_merge(ImageMetadata::getIgnoredAttributes(), GenericEntry::getIgnoredAttributes());
    $normalizers[0]->setIgnoredAttributes($igFields);
    $serializer = new Serializer($normalizers, $encoders);
    $jsonContent = $serializer->serialize($dirmeta, 'json');
    return $jsonContent;
  }

}
