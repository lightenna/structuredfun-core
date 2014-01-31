<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;

class MetadataFileReaderTest extends WebTestCase
{
	public function testGetListing() {
	  $t = new ViewController();
		$mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data'));
		$first = reset($mfr->getListing());
		$this->assertEquals($first->{'name'},'10-file_folder');
	}
}
