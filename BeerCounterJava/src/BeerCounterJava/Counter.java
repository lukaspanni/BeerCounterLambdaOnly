//Skill idea

package BeerCounterJava;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;

public class Counter {

	private int counter = 0;
	private long firstBeerSaved = -1;

	public static void main(String[] args) {
		Counter c = new Counter();
		System.out.println(c.getBeers());
		c.addBeers(15);
		System.out.println(c.getBeers());
		c.exit();
	}

	public Counter() {
		readPresistentData();
		checkTimeout();
	}

	public void exit() {
		writePersistentData();
	}

	public void addBeers(int amnt) {
		checkTimeout();
		counter += amnt;
		if (firstBeerSaved == -1) {
			firstBeerSaved = System.currentTimeMillis();
		}
	}

	public int getBeers() {
		checkTimeout();
		return counter;
	}

	private void checkTimeout() {
		if (firstBeerSaved == -1) {
			return;
		}
		long now = System.currentTimeMillis();
		if (firstBeerSaved + (24 * 60 * 60 * 1000) < now) {
			firstBeerSaved = -1;
			counter = 0;
		}
	}

	private void writePersistentData() {
		try (BufferedWriter bw = new BufferedWriter(new FileWriter("counter.beers", false))) {
			String str = String.valueOf(firstBeerSaved) + "," + String.valueOf(counter);
			bw.write(str);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	private void readPresistentData() {
		try (BufferedReader br = new BufferedReader(new FileReader("counter.beers"))) {
			String line = br.readLine();
			while (line != null) {
				parseLine(line);
				line = br.readLine();
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	private void parseLine(String line) {
		String[] split = line.split(",");
		if (split.length == 2) {
			firstBeerSaved = Long.parseLong(split[0]);
			counter = Integer.parseInt(split[1]);
		}
	}

}
