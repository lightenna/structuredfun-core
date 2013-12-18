<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ViewControllerTest extends WebTestCase
{
	public function testconvertRawToFilename() {
		$t = new \Lightenna\StructuredBundle\Controller\ViewController();
		// test path to Symfony
		$this->assertEquals($t::convertRawToFilename('data/my_directory/'),'/../../../data/my_directory');
		// test path without trailing /
		$this->assertEquals($t::convertRawToFilename('data/my_directory'),'/../../../data/my_directory');
		// test blank path
		$this->assertEquals($t::convertRawToFilename(''),'/../../../');
		// test path /
		$this->assertEquals($t::convertRawToFilename('/'),'/../../../');
		// test path .zip
		$this->assertEquals($t::convertRawToFilename('mydir/my.zip'),'/../../../mydir/my.zip');
		// test path .zip to .jpg
		$this->assertEquals($t::convertRawToFilename('mydir/my.zip~zippath/myzip.jpg'),'/../../../mydir/my.zip~zippath/myzip.jpg');
	}

	public function testGetExtension() {
		$t = new \Lightenna\StructuredBundle\Controller\ViewController();
		// find an extension
		$this->assertEquals($t::getExtension('data/my_directory/myfile.ext'),'ext');
		// find an upper case jpg
		$this->assertEquals($t::getExtension('data/my_directory/myfile.JPG'),'JPG');
		// find no extension
		$this->assertEquals($t::getExtension('data/my_directory/myfile'),false);
		// find no extension on a directory
		$this->assertEquals($t::getExtension('data/my_directory/myfile/'),false);
		// find an extension when there are args
		$this->assertEquals($t::getExtension('data/my_directory/myfile.jpg~args&test'),'jpg');
		// find an extension when there are args (malformed)
		$this->assertEquals($t::getExtension('data/my_directory/myfile.jpg~args&~args&test'),'jpg');
	}

	public function testGetArgsFromPath() {
		$t = new \Lightenna\StructuredBundle\Controller\ViewController();
		// test no args
		$this->assertEquals($t::getArgsFromPath('data/my_directory/myfile.ext'),array());
		// test 1 arg
		$this->assertEquals($t::getArgsFromPath('data/my_directory/myfile.ext~args&test=1'),array('test' => 1));
		// test 2 args
		$this->assertEquals($t::getArgsFromPath('data/my_directory/myfile.ext~args&test=1&k=v'),array('test' => 1, 'k' => 'v'));
		// test bad arg
		$this->assertEquals($t::getArgsFromPath('data/my_directory/myfile.ext~args&test'),array('test' => null));
	}
}
