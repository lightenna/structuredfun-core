<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Lightenna\StructuredBundle\Controller\FileviewController;
use Lightenna\StructuredBundle\DependencyInjection\ImageTransform;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\Entity\Arguments;
use Lightenna\StructuredBundle\Tests\DependencyInjection\BaseWebTestCase;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Request;

class FileviewControllerTest extends BaseWebTestCase
{
    public function testFileRoutes()
    {
        // create request client
        $match = '';
        $this->fireRequestAndCheckForContent('/file', $match);
        $this->fireRequestAndCheckForContent('/file/', $match);
        $this->fireRequestAndCheckForContent('/filenocache/', $match);
        $this->fireRequestAndCheckForContent('/filecacherefresh/', $match);
    }

    private function fireRequestAndCheckForContent($url, $match)
    {
        // fire a simple request for test URL
        $crawler = $this->client->request('GET', $url);
        // check the returned content for some basic known HTML
        $content = $this->client->getResponse()->getContent();
        $this->assertContains($match, $content);
    }

}
