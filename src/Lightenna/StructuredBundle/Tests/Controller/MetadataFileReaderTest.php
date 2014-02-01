<?php

namespace Lightenna\StructuredBundle\Tests\Controller;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;

class MetadataFileReaderTest extends WebTestCase {

  public function testGetListing() {
    $t = new ViewController();
    // read first entry in standard folder
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data'));
    $first = reset($mfr->getListing());
    $this->assertEquals($first->{'name'}, '10-file_folder');
    // read first entry in zip folder
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    $first = reset($mfr->getListing());
    $this->assertEquals($first->{'name'}, '00980001.JPG');
    // read first entry in folder inside zip folder
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'));
    $first = reset($mfr->getListing());
    $this->assertEquals($first->{'name'}, '00980006.JPG');
  }
}
