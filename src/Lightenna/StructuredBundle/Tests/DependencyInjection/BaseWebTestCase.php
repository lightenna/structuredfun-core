<?php

namespace Lightenna\StructuredBundle\Tests\DependencyInjection;

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

}

