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

}
