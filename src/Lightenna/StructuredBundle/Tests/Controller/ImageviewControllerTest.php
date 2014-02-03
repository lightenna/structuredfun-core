<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ImageviewControllerTest extends WebTestCase
{
	public function testImageCalcNewSize() {
		$t = new \Lightenna\StructuredBundle\Controller\ImageviewController();
		// setup vars for standard images
		$long = 500;
		$short = 400;
		$restricted = 200;
		// create standard input images
		$wide = imagecreatetruecolor($long, $short);
		$tall = imagecreatetruecolor($short, $long);
		// test width-limited landscape resize
		$t->setArgs(array('maxwidth' => $restricted));
		$t->imageCalcNewSize($wide);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'}, $restricted);
		$this->assertEquals($stats->{'newheight'} < $restricted, true);
		// test height-limited portrait resize
		$t->setArgs(array('maxheight' => $restricted));
		$t->imageCalcNewSize($tall);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'} < $restricted, true);
		$this->assertEquals($stats->{'newheight'}, $restricted);
		// test unrestricted resize
		$t->setArgs(array());
		$t->imageCalcNewSize($wide);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'}, $long);
		$this->assertEquals($stats->{'newheight'}, $short);
		// test weird width-limited portrait resize
		$t->setArgs(array('maxwidth' => $restricted));
		$t->imageCalcNewSize($tall);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'}, $restricted);
		$this->assertEquals($stats->{'newheight'} > $restricted, true);
		// test width-limited landscape resize using longest
		$t->setArgs(array('maxlongest' => $restricted));
		$t->imageCalcNewSize($wide);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'}, $restricted);
		$this->assertEquals($stats->{'newheight'} < $restricted, true);
		// test height-bound landscape resize using shortest
		$t->setArgs(array('maxshortest' => $restricted));
		$t->imageCalcNewSize($wide);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'} > $restricted, true);
		$this->assertEquals($stats->{'newheight'} == $restricted, true);
		// test height-limited portrait resize using longest
		$t->setArgs(array('maxlongest' => $restricted));
		$t->imageCalcNewSize($tall);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'} < $restricted, true);
		$this->assertEquals($stats->{'newheight'} == $restricted, true);
	}

	public function testfilterImage() {
		$t = new \Lightenna\StructuredBundle\Controller\ImageviewController();
		// setup vars for standard images
		$long = 500;
		$short = 400;
		$restricted = 200;
		// create standard input images
		$wide = imagecreatetruecolor($long, $short);
		$tall = imagecreatetruecolor($short, $long);
		// test raw clipping
		$t->setArgs(array('clipwidth' => $restricted, 'clipheight' => $restricted));
		$wide_data_copy = $t::getImageData($wide);
		$t->filterImage($wide_data_copy);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'} == $restricted, true);
		$this->assertEquals($stats->{'newheight'} == $restricted, true);
		// test expanding using clipping functions [not really supported]
		$t->setArgs(array('clipwidth' => $restricted, 'clipheight' => 2*$long));
		$data_copy = $t::getImageData($wide);
		$t->filterImage($data_copy);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'} == $restricted, true);
		$this->assertEquals($stats->{'newheight'} == 2*$long, true);
		// test height-bound landscape resize using shortest, followed by a clip
		$t->setArgs(array('maxshortest' => $restricted, 'clipwidth' => $restricted, 'clipheight' => $restricted));
		$data_copy = $t::getImageData($tall);
		$t->filterImage($data_copy);
		$stats=$t->getStats();
		$this->assertEquals($stats->{'newwidth'} == $restricted, true);
		$this->assertEquals($stats->{'newheight'} == $restricted, true);
	}
}
