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
		$this->assertEquals($t->getStats()['newwidth'], $restricted);
		$this->assertEquals($t->getStats()['newheight'] < $restricted, true);
		// test height-limited portrait resize
		$t->setArgs(array('maxheight' => $restricted));
		$t->imageCalcNewSize($tall);
		$this->assertEquals($t->getStats()['newwidth'] < $restricted, true);
		$this->assertEquals($t->getStats()['newheight'], $restricted);
		// test unrestricted resize
		$t->setArgs(array());
		$t->imageCalcNewSize($wide);
		$this->assertEquals($t->getStats()['newwidth'], $long);
		$this->assertEquals($t->getStats()['newheight'], $short);
		// test weird width-limited portrait resize
		$t->setArgs(array('maxwidth' => $restricted));
		$t->imageCalcNewSize($tall);
		$this->assertEquals($t->getStats()['newwidth'], $restricted);
		$this->assertEquals($t->getStats()['newheight'] > $restricted, true);
	}
}
