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
    // get listing for a single file
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
    $first = reset($mfr->getListing());
    $this->assertEquals($first->{'name'}, '00980001.JPG');    
    // get listing for a single file in a zip
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    $first = reset($mfr->getListing());
    $this->assertEquals($first->{'name'}, '00980001.JPG');    
    // get listing for a single file in a nested folder in a zip
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'));
    $first = reset($mfr->getListing());
    $this->assertEquals($first->{'name'}, '00980006.JPG');    
  }

  public function testIsExisting() {
    $t = new ViewController();
    // check folder exists
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder'));
    $this->assertEquals($mfr->isExisting(), true);
    // check folder does not exist
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/00-nosuch_folder'));
    $this->assertEquals($mfr->isExisting(), false);
    // check zip file exists
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    $this->assertEquals($mfr->isExisting(), true);
    // check zip nested folder exists
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'));
    $this->assertEquals($mfr->isExisting(), true);
    // check zip nested folder exists (with trailing /)
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/'));
    $this->assertEquals($mfr->isExisting(), true);
    // check file exists inside zip
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980006.JPG'));
    $this->assertEquals($mfr->isExisting(), true);    
    // check file does not exist inside zip
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/77980006.JPG'));
    $this->assertEquals($mfr->isExisting(), false);    
  }
  
  public function testIsDirectory() {
    $t = new ViewController();
    // check folder is directory
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder'));
    $this->assertEquals($mfr->isDirectory(), true);
    // check folder does not exist, so is not directory
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/00-nosuch_folder'));
    $this->assertEquals($mfr->isDirectory(), null);
    // check zip file is directory
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    $this->assertEquals($mfr->isDirectory(), true);
    // check zip nested folder exists
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'));
    $this->assertEquals($mfr->isDirectory(), true);
    // check zip nested folder exists (with trailing /)
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/'));
    $this->assertEquals($mfr->isDirectory(), true);
    // check file exists inside zip
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980006.JPG'));
    $this->assertEquals($mfr->isDirectory(), false);    
    // check file does not exist inside zip
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/77980006.JPG'));
    $this->assertEquals($mfr->isDirectory(), false);    
  }
  
}
