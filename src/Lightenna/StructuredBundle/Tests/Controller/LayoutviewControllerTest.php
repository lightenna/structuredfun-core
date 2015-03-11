<?php

namespace Lightenna\StructuredBundle\Tests\Controller;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\Controller\LayoutviewController;
use Lightenna\StructuredBundle\DependencyInjection\LayerOuter;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

class LayoutviewControllerTest extends WebTestCase {

  public function testLayoutListing() {
    $t = new LayoutviewController();
    // read first entry in standard folder
    $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/20-image_folder'), $t);
    // need to make sure all images are in the cache
    $listing = $mfr->getListing();
    $mfr->getAll($listing);
    $l = new LayerOuter($listing);
    // build several layouts (fast)
    $l->layout(2, 'x');
    $l->layout(4, 'x');
    $l->layout(8, 'x');
    $l->layout(2, 'y');
    $l->layout(4, 'y');
    $l->layout(8, 'y');
    // check for normal_width|height values in listing
    $this->assertEquals($listing[0]->getMetadata()->getNormalWidth(2,'y') > 0.0, true);
    $this->assertEquals($listing[0]->getMetadata()->getNormalHeight(2,'x') > 0.0, true);
  }

  public function testBucketListing() {
    $t = new LayoutviewController();
    // read first entry in standard folder
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/20-image_folder'), $t);
    $listing = $mfr->getListing();
    $l = new LayerOuter($listing);
    $buckets = $l->bucketListing($listing, 2);
    // look for a 2nd cell in 3rd bucket
    $entry = $buckets[2][1];
    $this->assertEquals($entry->getName(), '00980006.JPG');
  }

}
