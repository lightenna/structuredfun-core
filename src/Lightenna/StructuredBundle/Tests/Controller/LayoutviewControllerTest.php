<?php

namespace Lightenna\StructuredBundle\Tests\Controller;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\Controller\LayoutviewController;
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
    // build several layouts (fast)
    $t->layoutListing($listing, 2, 'x');
    $t->layoutListing($listing, 4, 'x');
    $t->layoutListing($listing, 8, 'x');
    $t->layoutListing($listing, 2, 'y');
    $t->layoutListing($listing, 4, 'y');
    $t->layoutListing($listing, 8, 'y');
    // check for normal_width|height values in listing
    $this->assertEquals($listing[0]->getMetadata()->getNormalWidth(2,'y') > 0.0, true);
    $this->assertEquals($listing[0]->getMetadata()->getNormalHeight(2,'x') > 0.0, true);
  }

  public function testBucketListing() {
    $t = new LayoutviewController();
    // read first entry in standard folder
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/20-image_folder'), $t);
    $listing = $mfr->getListing();
    $buckets = $t->bucketListing($listing, 2);
    // look for a 2nd cell in 3rd bucket
    $entry = $buckets[2][1];
    $this->assertEquals($entry->getName(), '00980006.JPG');
  }

}
