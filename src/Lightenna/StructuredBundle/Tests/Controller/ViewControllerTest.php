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
		$this->assertEquals(ViewController::convertUrlToFilename('data/my_directory'),'fish');
	}
}
