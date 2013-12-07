<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ViewControllerTest extends WebTestCase
{
	/**
	 *
	public function testIndex()
	{
		$client = static::createClient();

		$crawler = $client->request('GET', '/hello/Fabien');

		$this->assertTrue($crawler->filter('html:contains("Hello Fabien")')->count() > 0);
	}
	 *
	 */

	public function testConvertUrlToFilename() {
		$t = new \Lightenna\StructuredBundle\Controller\ViewController();
		// test path to Symfony
		$this->assertEquals($t::convertUrlToFilename('data/my_directory'),'/../../../data/my_directory');
		// test blank path
		$this->assertEquals($t::convertUrlToFilename(''),'/../../../');
		// test path /
		$this->assertEquals($t::convertUrlToFilename('/'),'/../../../');
	}
}
