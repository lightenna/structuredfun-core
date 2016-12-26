<?php

namespace Lightenna\StructuredBundle\Tests\DependencyInjection;

use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class BaseWebTestCase extends WebTestCase
{
    /**
     * @var EntityManager
     * @var Doctrine
     * @var Logger
     */
    protected $_em = null;
    protected $_doctrine = null;
    protected $_logger;

    // single shared browser client
    protected $client = null;

    //
    // Setup and teardown functions
    //

    /**
     * Setup tests, including non-persistent database tests
     */
    protected function setUp($kernel = null)
    {
        if ($kernel === null) {
            $kernel = static::createKernel();
            $kernel->boot();
        }
        $this->_logger = $kernel->getContainer()->get('logger');
        // $this->_doctrine = $kernel->getContainer()->get('doctrine');
        // $this->_em = $kernel->getContainer()->get('doctrine.orm.entity_manager');
        // $this->_em->beginTransaction();
        // create request client
        $this->client = static::createClient();
    }

    /**
     * Rollback impact of database tests
     */
    protected function tearDown()
    {
        if ($this->_em != null) {
            $this->_em->rollback();
        }
    }

    /**
     * @param $url URL
     * This function doesn't cope with the cache/nocache variants
     * @return string Path to file in cache
     */
    protected function getCachedFileLocation($url)
    {
        // split identifier to work out what kind of cache we're using
        $url_token = explode(Constantly::DIR_SEPARATOR_URL, ltrim($url, Constantly::DIR_SEPARATOR_URL));
        $type = $url_token[0];
        // compose identifier out of everything apart from the first token
        unset($url_token[0]);
        $identifier = implode(Constantly::DIR_SEPARATOR_URL, $url_token);
        $t = new ViewController();
        // find path to cached index file
        $filename = $t->convertRawToFilename($identifier);
        $name = $t::convertRawToUrl($identifier);
        $mfr = new CachedMetadataFileReader($filename, $t);
        // tell mfr what type of cache we're looking for file/directory or image
        $file_cachedir = $mfr->setupCacheDir($type);
        $file_cache = $file_cachedir . $name;
        // attach correct filename and extension
        // @todo do this properly, this is a bit of a hack
        switch ($type) {
            case 'image' :
                $file_cache .= '.' . Constantly::CACHE_FILEEXT;
                break;
            case 'file' :
            default :
                $file_cache .= Constantly::DIR_SEPARATOR_URL . Constantly::DIR_INDEX_FILENAME . '.' . Constantly::CACHE_FILEEXT;
                break;
        }
        return $file_cache;
    }

}

