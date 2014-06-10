<?php

namespace Lightenna\StructuredBundle\Tests\Controller;
use Lightenna\StructuredBundle\Controller\ImageviewController;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ImageviewControllerTest extends WebTestCase {

  public function testImageCalcNewSize() {
    $t = new ImageviewController();
    // setup vars for standard images
    $long = 500;
    $short = 400;
    $restricted = 200;
    // create standard input images
    $wide = imagecreatetruecolor($long, $short);
    $tall = imagecreatetruecolor($short, $long);
    // test width-limited landscape resize
    $t->setArgsByArray(array(
        'maxwidth' => $restricted
      ));
    $t->imageCalcNewSize($wide);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'}, $restricted);
    $this->assertEquals($stats->{'newheight'} < $restricted, true);
    // test height-limited portrait resize
    $t->setArgsByArray(array(
        'maxheight' => $restricted
      ));
    $t->imageCalcNewSize($tall);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'} < $restricted, true);
    $this->assertEquals($stats->{'newheight'}, $restricted);
    // test unrestricted resize
    $t->setArgsByArray(array());
    $t->imageCalcNewSize($wide);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'}, $long);
    $this->assertEquals($stats->{'newheight'}, $short);
    // test weird width-limited portrait resize
    $t->setArgsByArray(array(
        'maxwidth' => $restricted
      ));
    $t->imageCalcNewSize($tall);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'}, $restricted);
    $this->assertEquals($stats->{'newheight'} > $restricted, true);
    // test width-limited landscape resize using longest
    $t->setArgsByArray(array(
        'maxlongest' => $restricted
      ));
    $t->imageCalcNewSize($wide);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'}, $restricted);
    $this->assertEquals($stats->{'newheight'} < $restricted, true);
    // test height-bound landscape resize using shortest
    $t->setArgsByArray(array(
        'maxshortest' => $restricted
      ));
    $t->imageCalcNewSize($wide);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'} > $restricted, true);
    $this->assertEquals($stats->{'newheight'} == $restricted, true);
    // test height-limited portrait resize using longest
    $t->setArgsByArray(array(
        'maxlongest' => $restricted
      ));
    $t->imageCalcNewSize($tall);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'} < $restricted, true);
    $this->assertEquals($stats->{'newheight'} == $restricted, true);
    // clean up images
    imagedestroy($wide);
    imagedestroy($tall);
  }

  public function testfilterImage() {
    $t = new ImageviewController();
    // setup vars for standard images
    $long = 500;
    $short = 400;
    $restricted = 200;
    // create standard input images
    $wide = imagecreatetruecolor($long, $short);
    $tall = imagecreatetruecolor($short, $long);
    // test raw clipping
    $t->setArgsByArray(array(
        'clipwidth' => $restricted,
        'clipheight' => $restricted
      ));
    $wide_data_copy = $t::getImageData($wide);
    $t->filterImage($wide_data_copy);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'} == $restricted, true);
    $this->assertEquals($stats->{'newheight'} == $restricted, true);
    // test expanding using clipping functions [not really supported]
    $t->setArgsByArray(array(
        'clipwidth' => $restricted,
        'clipheight' => 2 * $long
      ));
    $data_copy = $t::getImageData($wide);
    $t->filterImage($data_copy);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'} == $restricted, true);
    $this->assertEquals($stats->{'newheight'} == 2 * $long, true);
    // test height-bound landscape resize using shortest, followed by a clip
    $t->setArgsByArray(array(
        'maxshortest' => $restricted,
        'clipwidth' => $restricted,
        'clipheight' => $restricted
      ));
    $data_copy = $t::getImageData($tall);
    $t->filterImage($data_copy);
    $stats = $t->getStats();
    $this->assertEquals($stats->{'newwidth'} == $restricted, true);
    $this->assertEquals($stats->{'newheight'} == $restricted, true);
    // clean up images
    imagedestroy($wide);
    imagedestroy($tall);
  }

  public function testTakeSnapshot() {
    $t = new ImageviewController();
    // prime the controller with the video URL, generate thumbnail at 00:00:10.0
    $frame10s = $t->indexAction('structured/tests/data/40-video_folder/nasa-solar-flare-64x64.m4v', false);
    $leaf = 'test-nasa-solar-flare-64x64-t000900.dat';
    // create an MFR to get cache directory path
    $localmfr = new CachedMetadataFileReader(null, $t);
    // take snapshot at 00:00:09.0
    $outputname = $t->takeSnapshot('00:00:09.0', $localmfr->getFilename($leaf));
    // read the snapshot from 00:00:09.0
    $frame9s = file_get_contents($outputname);
    $this->assertNotEquals($frame10s, $frame9s);
    // check that both snapshots are not the error image
    $rawerrorimg = $t->loadErrorImage();
    $errorimg = $t->filterImage($rawerrorimg);
    $this->assertNotEquals($frame10s, $errorimg);
    $this->assertNotEquals($frame9s, $errorimg);
  }

  public function testPlatformImageLimits() {
    // expand memory limit for tests
    ini_set('memory_limit', '128M');
    // progressively test larger images
    // 1MP
    $this->assertNotEquals($img = imagecreatetruecolor(1 * 1000, 1 * 1000), null);
    imagedestroy($img);
    // 4MP
    $this->assertNotEquals($img = imagecreatetruecolor(2 * 1000, 2 * 1000), null);
    imagedestroy($img);
    // 16MP
    $this->assertNotEquals($img = imagecreatetruecolor(4 * 1000, 4 * 1000), null);
    imagedestroy($img);
    // 24MP
    $this->assertNotEquals($img = imagecreatetruecolor(4.9 * 1000, 4.9 * 1000), null); // limit of PHP @ 128M
    imagedestroy($img);
    if (intval(ini_get('memory_limit')) <= 128) return;
    // 25MP
    $this->assertNotEquals($img = imagecreatetruecolor(5 * 1000, 5 * 1000), null);
    imagedestroy($img);
    // 36MP
    $this->assertNotEquals($img = imagecreatetruecolor(6 * 1000, 6 * 1000), null);
    imagedestroy($img);
    // 49MP
    $this->assertNotEquals($img = imagecreatetruecolor(7 * 1000, 7 * 1000), null);
    imagedestroy($img);
    // 50.4MP
    $this->assertNotEquals($img = imagecreatetruecolor(7.1 * 1000, 7.1 * 1000), null); // limit of PHP @ 256M
    imagedestroy($img);
    if (intval(ini_get('memory_limit')) <= 256) return;
    // 64MP
    $this->assertNotEquals($img = imagecreatetruecolor(8 * 1000, 8 * 1000), null);
    imagedestroy($img);
    // 100MP
    $this->assertNotEquals($img = imagecreatetruecolor(10 * 1000, 10 * 1000), null);
    imagedestroy($img);
    // 101.4MP
    $this->assertNotEquals($img = imagecreatetruecolor(10.07 * 1000, 10.07 * 1000), null); // limit of PHP @ 512M
    imagedestroy($img);
    if (intval(ini_get('memory_limit')) <= 512) return;
    // 121MP
    $this->assertNotEquals($img = imagecreatetruecolor(16 * 1000, 16 * 1000), null);
    imagedestroy($img);
  }

  public function testFailureCases() {
    // test attempt to open a massive image
    $t = new ImageviewController();
    // prime the controller with the image's URL
    $img = $t->indexAction('structured/tests/data/50-fail_image_folder/[1]~args&thumb=true&maxlongest=200&', false);
    // load error image at same size (using $t's args from first call) and compare to massive image (error response)
    $rawerrorimg = $t->loadErrorImage();
    $errorimg = $t->filterImage($rawerrorimg);
    $this->assertEquals($img, $errorimg);
    // load a normal (smaller) image and check that it's not an error
    $img = imagecreatefromstring($t->indexAction('structured/tests/data/20-image_folder/[i1]~args&thumb=true&maxlongest=200&', false));
    $this->assertNotEquals($img, $errorimg);
  }

  public function testImageFromTestshare() {
    $t = new ImageviewController();
    // load image via testshare (required controller)
    $imgdata = $t->indexAction('structured/testshare/30-zip_folder.zip/nested/00980006.JPG', false);
    // load the same image from a direct path for comparison
    $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980006.JPG'), $t);
    $this->assertEquals($mfr->isExisting(), true);
    // compare images
    $this->assertEquals($mfr->get(), $imgdata);
  }
  
}
