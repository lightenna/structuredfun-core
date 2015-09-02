<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\Entity\ImageMetadata;

class Rectangle
{

    protected $x1, $y1, $x2, $y2;

    /**
     * Construct either as
     * new Rectangle(x1,y1,x2,y2) or
     * new Rectangle([x1, y2, x2, y2])
     */
    public function __construct($a1, $b1, $a2, $b2)
    {
        if (is_array($a1)) {
            $this->x1 = $a1[0];
            $this->y1 = $a1[1];
            $this->x2 = $a1[2];
            $this->y2 = $a1[3];
        } else {
            $this->x1 = $a1;
            $this->y1 = $b1;
            $this->x2 = $a2;
            $this->y2 = $b2;
        }
    }

    public function equals($r)
    {
        return $r->equalsValues($this->x1, $this->y1, $this->x2, $this->y2);
    }

    public function equalsValues($a1, $b1, $a2, $b2)
    {
        return (
            $this->x1 == $a1 &&
            $this->y1 == $b1 &&
            $this->x2 == $a2 &&
            $this->y2 == $b2
        );
    }

    /**
     * @param  object $r named rectangle
     * @return boolean true if any part of the named rectangle intersects this rectangle
     */
    public function intersects($r)
    {
        // test if any of four points are inside
        if (
            $this->contains($r->getX1(), $r->getY1()) ||
            $this->contains($r->getX2(), $r->getY1()) ||
            $this->contains($r->getX1(), $r->getY2()) ||
            $this->contains($r->getX2(), $r->getY2())
        ) {
            return true;
        }
        return false;
    }

    /**
     * @return boolean true if this named point lies within this rectangle
     */
    public function contains($x, $y)
    {
        if (($x >= $this->x1) && ($y >= $this->y1) && ($x <= $this->x2) && ($y <= $this->y2)) {
            return true;
        }
        return false;
    }

    public function toString()
    {
        return ('x1,y1(' . $this->x1 . ',' . $this->y1 . ') x2,y2(' . $this->x2 . ',' . $this->y2 . ')');
    }

    public function getX1()
    {
        return $this->x1;
    }

    public function getY1()
    {
        return $this->y1;
    }

    public function getX2()
    {
        return $this->x2;
    }

    public function getY2()
    {
        return $this->y2;
    }

}
