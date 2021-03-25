const { expect } = require("chai");
const { time } = require("@openzeppelin/test-helpers");

describe("CustomVesting", function () {
	const MINT_AMOUNT = ethers.utils.parseEther("1000");
	const TIMESTAMPS = [1614556800, 1630324800, 1646092800, 1646092801]; // start, mid, end, end + 1
	let owner, ownerAddress, p1, p1Address, bogeyAccount, bogeyAddress;
	before(async () => {
		const accounts = await ethers.getSigners();
		[owner, p1, bogeyAccount] = accounts;
		ownerAddress = await owner.getAddress();
		p1Address = await p1.getAddress();
		bogeyAddress = await bogeyAccount.getAddress();

		VestingToken = await ethers.getContractFactory("ERC20");
		vestingToken = await VestingToken.deploy("Test", "Test");
		await vestingToken.deployed();

		Vesting = await ethers.getContractFactory("CustomVesting");
		vesting = await Vesting.deploy();
		await vesting.deployed();
		await vestingToken.mint(vesting.address, MINT_AMOUNT);
	});

	it("Should no allow pause if schedule doesn't exist", async function () {
		await expect(vesting.connect(owner).setPause(p1Address, true)).to.be.revertedWith(
			"Vesting: user has no vesting schedule"
		);
	});

	it("Should add new vesting schedule", async function () {
		await expect(
			vesting.connect(owner).addVestingSchedule(p1Address, vestingToken.address, MINT_AMOUNT, TIMESTAMPS[2], TIMESTAMPS[0])
		).to.be.revertedWith("Vesting: _startTime >= _endTime");
		await vesting
			.connect(owner)
			.addVestingSchedule(p1Address, vestingToken.address, MINT_AMOUNT, TIMESTAMPS[0], TIMESTAMPS[2]);
		const { isPaused, vested, total, startTime, endTime } = await vesting.vesting(p1Address);
		expect(isPaused).to.equal(false);
		expect(vested).to.equal(0);
		expect(total).to.equal(MINT_AMOUNT);
		expect(startTime).to.equal(TIMESTAMPS[0]);
		expect(endTime).to.equal(TIMESTAMPS[2]);
		await expect(
			vesting.connect(owner).addVestingSchedule(p1Address, vestingToken.address, MINT_AMOUNT, TIMESTAMPS[0], TIMESTAMPS[2])
		).to.be.revertedWith("Vesting: user already has a vesting schedule");
	});

	it("Should not allow vest if paused", async function () {
		await vesting.connect(owner).setPause(p1Address, true);
		// cannot pause if already paused
		await expect(vesting.connect(owner).setPause(p1Address, true)).to.be.revertedWith("Vesting: pause status must change");

		await expect(vesting.connect(p1).vest()).to.be.revertedWith("Vesting: user's vesting is paused!");
		await vesting.connect(owner).setPause(p1Address, false);
	});

	it("Should allow dev to withdraw 1/2 of all tokens at the end of 6 months", async function () {
		await time.increaseTo(TIMESTAMPS[1]);
		await time.advanceBlock();
		await vesting.connect(p1).vest();
		const bal = await vestingToken.balanceOf(p1Address);
		const totalReleased = parseInt(ethers.utils.formatUnits(bal, "ether"));
		const totalAllocated = parseInt(ethers.utils.formatUnits(MINT_AMOUNT, "ether"));
		expect(totalReleased).to.equal(totalAllocated / 2);
	});

	it("Should delete user's vesting schedule", async function () {
		// Should not allow deletion of non-existent schedule
		await expect(vesting.connect(owner).deleteVestingSchedule(bogeyAddress, true)).to.be.revertedWith(
			"Vesting: user has no vesting schedule"
		);

		await time.increaseTo(TIMESTAMPS[2]);
		await time.advanceBlock();
		const unvestedBal = await vestingToken.balanceOf(vesting.address);
		const p1BalBefore = await vestingToken.balanceOf(p1Address);
		const releasableBal = await vesting.releasableAmount(p1Address);
		await vesting.connect(owner).deleteVestingSchedule(p1Address, true);

		// User should receive his "vested" amount, rest goes to owner
		const p1BalAfter = await vestingToken.balanceOf(p1Address);
		expect(p1BalAfter).to.equal(p1BalBefore.add(releasableBal));

		// owner should receive the unvested tokens
		const ownerBal = await vestingToken.balanceOf(ownerAddress);
		expect(ownerBal).to.equal(unvestedBal - releasableBal);

		// vesting data should be deleted
		const { isPaused, vested, total, startTime, endTime } = await vesting.vesting(p1Address);
		expect(isPaused).to.equal(false);
		expect(vested).to.equal(0);
		expect(total).to.equal(0);
		expect(startTime).to.equal(0);
		expect(endTime).to.equal(0);

		// should not allow vesting once user is deleted
		await expect(vesting.connect(owner).vest()).to.be.revertedWith("Vesting: no vesting schedule!");
	});
});
