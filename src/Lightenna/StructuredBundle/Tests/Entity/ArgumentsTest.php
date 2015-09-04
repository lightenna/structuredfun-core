<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Entity\Arguments;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class ArgumentsTest extends WebTestCase
{
    public function testArguments()
    {
        $restricted = 200;
        $t = new Arguments();
        // check initialised unset
        $this->assertEquals($t->hasMaxWidth(), false);
        // parse IIIF params
        $t->parseArgs('full', 'full');
        // check we still haven't set a maxwidth
        $this->assertEquals($t->hasMaxWidth(), false);
        // check empty response
        $t->parseArgs('full', ',');
        $this->assertEquals($t->hasMaxWidth(), false);
        $this->assertEquals($t->hasMaxHeight(), false);
        // check singles
        $t->parseArgs('full', ','.$restricted);
        $this->assertEquals($t->hasMaxWidth(), false);
        $this->assertEquals($t->getMaxHeight(), $restricted);
        $t->setMaxHeight(null);
        $t->parseArgs('full', $restricted.',');
        $this->assertEquals($t->getMaxWidth(), $restricted);
        $this->assertEquals($t->hasMaxHeight(), false);
        // check both
        $t->parseArgs('full', ($restricted).','.($restricted+1));
        $this->assertEquals($t->getMaxWidth(), $restricted);
        $this->assertEquals($t->getMaxHeight(), $restricted+1);
        // check both with !
        $t->parseArgs('full', '!'.($restricted+1).','.($restricted));
        $this->assertEquals($t->getMaxWidth(), $restricted+1);
        $this->assertEquals($t->getMaxHeight(), $restricted);
        // check singles with !
        $t->setMaxWidth(null);
        $t->parseArgs('full', '!'.','.($restricted));
        $this->assertEquals($t->hasMaxWidth(), false);
        $this->assertEquals($t->getMaxHeight(), $restricted);
    }
}

