<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class Timer
{

    protected $start;

    public function __construct()
    {
        $this->reset();
    }

    public function get() {
        $diff = static::getTime() - $this->start;
        return $diff;
    }

    public function getString() {
        $t = $this->get();
        return static::formatTime($t);
    }

    public function reset() {
        $this->start = static::getTime();
    }

    static function formatTime($t) {
        if ($t < 1000) {
            return round($t, 0).'ms';
        }
        if ($t < 100000) {
            return round($t / 1000, 2).'s';
        }
        $min = floor(($t/1000) / 60);
        return $min . 'min ' . static::formatTime($t - (60 * 1000 * $min));
    }

    static function getTime() {
        return microtime(true) * 1000;
    }

}
