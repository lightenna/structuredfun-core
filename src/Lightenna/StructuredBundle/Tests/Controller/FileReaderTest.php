<?php

namespace Lightenna\StructuredBundle\Tests\Controller;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;

class FileReaderTest extends WebTestCase {

  public function testSplitPathLeaf() {
    $t = new ViewController();
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data'));
    // test basic file split
    $this->assertEquals($fr->splitPathLeaf('fish/fowl.ext'), array('fish','fowl.ext'));
    // test zip split
    $this->assertEquals($fr->splitPathLeaf('fish.zip/fowl.ext'), array('fish.zip','fowl.ext'));
    // test basic no file
    $this->assertEquals($fr->splitPathLeaf('fish'), array('fish',null));
    // test basic no file with slash
    $this->assertEquals($fr->splitPathLeaf('fish/'), array('fish/',null));
    // test file no path
    $this->assertEquals($fr->splitPathLeaf('fish.ext'), array('','fish.ext'));
    // test multi-part path file split
    $this->assertEquals($fr->splitPathLeaf('fish/guppi/cod/herring/fowl.ext'), array('fish/guppi/cod/herring','fowl.ext'));
    // test multi-part path no file split
    $this->assertEquals($fr->splitPathLeaf('fish/guppi/cod/herring'), array('fish/guppi/cod/herring',null));
  }

  public function testGetFilenameFileReader() {
    $t = new ViewController();
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data'));
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data'));
    // read first entry in standard folder
    $fr = new FileReader($t->convertRawToFilename('/structured/testshare/'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/testshare'));
    // read first entry in zip folder
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    // read first entry in folder inside zip folder
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    // get listing for a single file
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
    // get listing for a single file in a zip
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/00980002.JPG'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    // get listing for a single file in a nested folder in a zip
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980007.JPG'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
    // get listing for a single file, but strip arguments
    $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'.ARG_SEPARATOR.'arg1=v1&arg2=v2'), $t);
    $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
  }

}
