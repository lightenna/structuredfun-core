<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Doctrine\ORM\Tools\SchemaTool;

class DatabaseLocalManager
{

    protected $controller = null;
    protected $em = null;

    public function __construct($con)
    {
        $this->controller = $con;
        // can't get to request object yet
    }

    public function getEntityManager() {
        if (!$this->em) {
            $this->instantiateDB();
        }
        return $this->em;
    }

    private function instantiateDB() {
        $this->em = $this->doctrine->getManager();
        if (false) {
            // create database from scratch
            $schemaTool = new SchemaTool($this->em);
            $classes = $this->em->getMetadataFactory()->getAllMetadata();
            $schemaTool->createSchema($classes);
        }
    }

}
