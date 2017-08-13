<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Lightenna\StructuredBundle\DependencyInjection\Constantly;
use Lightenna\StructuredBundle\Tests\DependencyInjection\BaseWebTestCase;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;

class FileviewControllerTest extends BaseWebTestCase
{
    public function testFileRouteRoot()
    {
        $identifier = Constantly::DIR_INDEX_FILENAME;
        $file_cache = $this->getCachedFileLocation('/file' . $identifier);
        $match = '<title>Directory / - StructuredFun</title>';
        // fire request
        $this->fireRequestAndCheckForContent('/file/' . $identifier, $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, FileReader::protectFileExists($file_cache));
        $this->fireRequestAndCheckForContent('/file', $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, FileReader::protectFileExists($file_cache));
        $this->fireRequestAndCheckForContent('/filenocache/', $match, $file_cache);
        // check that cache entry is not generated (nocache)
        $this->assertEquals(false, FileReader::protectFileExists($file_cache));
        $this->fireRequestAndCheckForContent('/filecacherefresh/', $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, FileReader::protectFileExists($file_cache));
    }

    public function testFileRouteTestData()
    {
        $identifier = 'structured~2Ftests~2Fdata';
        $file_cache = $this->getCachedFileLocation('/file/' . $identifier);
        $match = '<title>Directory /' . $identifier . ' - StructuredFun</title>';
        // fire request
        $this->fireRequestAndCheckForContent('/file/' . $identifier, $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, FileReader::protectFileExists($file_cache));
    }

    public function testSingleNestedDirForward()
    {
        $identifier = 'structured~2Ftests';
        $match = '<title>Directory /' . $identifier . Constantly::DIR_SEPARATOR_ALIAS . 'data' . ' - StructuredFun</title>';
        // fire request
        $this->fireRequestAndCheckForContent('/file/' . $identifier, $match);
    }

    //
    // HELPERS
    //

    private function fireRequestAndCheckForContent($url, $match, $file_cache = null)
    {
        // scrub existing cache entry for this route
        if (($file_cache !== null) && FileReader::protectFileExists($file_cache)) {
            unlink($file_cache);
        }
        // fire a simple request for test URL
        $this->client->followRedirects();
        $crawler = $this->client->request('GET', $url);
        // check the returned content for some basic known HTML
        $content = $this->client->getResponse()->getContent();
        $this->assertContains($match, $content);
    }

}
