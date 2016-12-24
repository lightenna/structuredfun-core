<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\Tests\DependencyInjection\BaseWebTestCase;

class FileviewControllerTest extends BaseWebTestCase
{
    public function testFileRouteRoot()
    {
        $identifier = 'index.html';
        $file_cache = $this->getCachedFileLocation($identifier);
        $match = '<title>Directory / - StructuredFun</title>';
        // fire request
        $this->fireRequestAndCheckForContent('/file/' . $identifier, $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, file_exists($file_cache));
        $this->fireRequestAndCheckForContent('/file', $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, file_exists($file_cache));
        $this->fireRequestAndCheckForContent('/filenocache/', $match, $file_cache);
        // check that cache entry is not generated (nocache)
        $this->assertEquals(false, file_exists($file_cache));
        $this->fireRequestAndCheckForContent('/filecacherefresh/', $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, file_exists($file_cache));
    }

    public function testFileRouteTestData()
    {
        $identifier = 'structured~2Ftests~2Fdata';
        $file_cache = $this->getCachedFileLocation($identifier);
        $match = '<title>Directory /' . $identifier . ' - StructuredFun</title>';
        // fire request
        $this->fireRequestAndCheckForContent('/file/' . $identifier, $match, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, file_exists($file_cache));
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
        if (($file_cache !== null) && file_exists($file_cache)) {
            unlink($file_cache);
        }
        // fire a simple request for test URL
        $this->client->followRedirects();
        $crawler = $this->client->request('GET', $url);
        // check the returned content for some basic known HTML
        $content = $this->client->getResponse()->getContent();
        $this->assertContains($match, $content);
    }

    private function getCachedFileLocation($identifier)
    {
        $t = new ViewController();
        // find path to cached index file
        $filename = $t->convertRawToFilename($identifier);
        $name = $t::convertRawToUrl($identifier);
        $mfr = new CachedMetadataFileReader($filename, $t);
        // assumption that we're looking for a file/directory (not image)
        $file_cachedir = $mfr->setupCacheDir('file');
        $file_cache = $file_cachedir . $name . Constantly::DIR_SEPARATOR_URL . Constantly::DIR_INDEX_FILENAME . '.' . Constantly::CACHE_FILEEXT;
        return $file_cache;
    }

}
