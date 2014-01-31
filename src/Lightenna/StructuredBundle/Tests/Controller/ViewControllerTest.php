<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;

class ViewControllerTest extends WebTestCase
{
	public function testconvertRawToFilename() {
		$t = new ViewController();
		// tests being run in this environment without a $_SERVER['DOCUMENT_ROOT']
		// but can derive from $_SERVER['PHPRC']
		if (isset($_SERVER['PHPRC'])) {
		  $_SERVER['DOCUMENT_ROOT'] = str_replace('conf', 'htdocs/web', $_SERVER['PHPRC']);
		}
		else if (isset($_SERVER['PWD'])) {
		  $_SERVER['DOCUMENT_ROOT'] = str_replace('htdocs', 'htdocs/web', $_SERVER['PWD']);
		}
		// test path to Symfony
		$this->assertEquals($t->convertRawToFilename('data/my_directory/'),$_SERVER['DOCUMENT_ROOT'].'/../../../data/my_directory');
		// test path without trailing /
		$this->assertEquals($t->convertRawToFilename('data/my_directory'),$_SERVER['DOCUMENT_ROOT'].'/../../../data/my_directory');
		// test blank path
		$this->assertEquals($t->convertRawToFilename(''),$_SERVER['DOCUMENT_ROOT'].'/../../../');
		// test path /
		$this->assertEquals($t->convertRawToFilename('/'),$_SERVER['DOCUMENT_ROOT'].'/../../../');
		// test path .zip
		$this->assertEquals($t->convertRawToFilename('mydir/my.zip'),$_SERVER['DOCUMENT_ROOT'].'/../../../mydir/my.zip');
		// test path .zip to .jpg
		$this->assertEquals($t->convertRawToFilename('mydir/my.zip'.ZIP_SEPARATOR.'zippath/myzip.jpg'),$_SERVER['DOCUMENT_ROOT'].'/../../../mydir/my.zip'.ZIP_SEPARATOR.'zippath/myzip.jpg');
	}

	public function testConvertRawToUrl() {
		$t = new ViewController();
		// test blank
		$this->assertEquals($t::convertRawToUrl(''),'/');
		$this->assertEquals($t::convertRawToUrl('/'),'/');
		// test single word
		$this->assertEquals($t::convertRawToUrl('fish'),'/fish');
		$this->assertEquals($t::convertRawToUrl('/fish'),'/fish');
		// test single word with trailing slash
		$this->assertEquals($t::convertRawToUrl('fish/'),'/fish');
		$this->assertEquals($t::convertRawToUrl('/fish/'),'/fish');
		// test multiple words with trailing slash
		$this->assertEquals($t::convertRawToUrl('fish/fowl/'),'/fish/fowl');
		$this->assertEquals($t::convertRawToUrl('/fish/fowl/'),'/fish/fowl');
	}

	public function testGetExtension() {
		$t = new ViewController();
		// find an extension
		$this->assertEquals($t::getExtension('data/ext_directory/myfile.ext'),'ext');
		// find an upper case jpg
		$this->assertEquals($t::getExtension('data/ext_directory/myfile.JPG'),'JPG');
		// find no extension
		$this->assertEquals($t::getExtension('data/ext_directory/myfile'),false);
		// find no extension on a directory
		$this->assertEquals($t::getExtension('data/ext_directory/myfile/'),false);
		// find an extension when there are args
		$this->assertEquals($t::getExtension('data/ext_directory/myfile.jpg'.ARG_SEPARATOR.'test'),'jpg');
		// find an extension when there are args (malformed)
		$this->assertEquals($t::getExtension('data/ext_directory/myfile.jpg'.ARG_SEPARATOR.''.ARG_SEPARATOR.'test'),'jpg');
	}

	public function testGetArgsFromPath() {
		$t = new ViewController();
		// test no args
		$this->assertEquals($t::getArgsFromPath('data/arg_directory/myfile.ext'),array());
		// test 1 arg
		$this->assertEquals($t::getArgsFromPath('data/arg_directory/myfile.ext'.ARG_SEPARATOR.'test=1'),array('test' => 1));
		// test 2 args
		$this->assertEquals($t::getArgsFromPath('data/arg_directory/myfile.ext'.ARG_SEPARATOR.'test=1&k=v'),array('test' => 1, 'k' => 'v'));
		// test bad arg
		$this->assertEquals($t::getArgsFromPath('data/arg_directory/myfile.ext'.ARG_SEPARATOR.'test'),array('test' => null));
	}

	/**
	 * This requires the FileReader to be working
	public function testPerformFilenameSubstitution() {
		$t = new ViewController();
		// test no substitution
		$this->assertEquals($t->convertRawToFilename('structured/tests/data/'), $t->convertRawToFilename('structured/tests/data/'));
		// test simple [1]
		$this->assertEquals($t->convertRawToFilename('structured/tests/[1]/'), $t->convertRawToFilename('structured/tests/data/'));
		// test two subs
		$this->assertEquals($t->convertRawToFilename('structured/tests/[1]/[1]'), $t->convertRawToFilename('structured/tests/data/10-file_folder'));
		// test nth, 30-zip_folder is 3rd in tests/data
		$this->assertEquals($t->convertRawToFilename('structured/tests/[1]/[3]'), $t->convertRawToFilename('structured/tests/data/30-zip_folder.zip'));
		// test zip extract
		$this->assertEquals($t->convertRawToFilename('structured/tests/data/30-zip_folder.zip/[1]'), $t->convertRawToFilename('structured/tests/data/30-zip_folder.zip/00980001.JPG'));
		// test nth and zip extract
		$this->assertEquals($t->convertRawToFilename('structured/tests/[1]/[3]/[1]'), $t->convertRawToFilename('structured/tests/data/30-zip_folder.zip/00980001.JPG'));
		// @todo this test fails because we haven't coded for this case yet
		// test zip extract from nested folder [FAILS]
		// $this->assertEquals($t->convertRawToFilename('structured/tests/data/30-zip_folder.zip/nested/[1]'), $t->convertRawToFilename('structured/tests/data/30-zip_folder.zip/00980001.JPG'));
		// test nth from mixed folder
		$this->assertEquals($t->convertRawToFilename('structured/tests/[1]/10-file_folder/[1]'), $t->convertRawToFilename('structured/tests/data/10-file_folder/00980000.txt'));
		// test nth-image from mixed folder
		$this->assertEquals($t->convertRawToFilename('structured/tests/[1]/10-file_folder/[i1]'), $t->convertRawToFilename('structured/tests/data/10-file_folder/00980001.JPG'));
	}
	*/
}
